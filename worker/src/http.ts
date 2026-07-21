import { MemoryRateLimiter } from "./rateLimit";
import { attemptAdminLogin } from "./adminAuth";
import {
  countRecentGuestbookWrites,
  createGuestbook,
  decodeGuestbookCursor,
  deleteGuestbook,
  findGuestbook,
  getGuestbookDeleteAt,
  listAdminGuestbook,
  listGuestbookPage,
  moderateGuestbook,
  updateGuestbook
} from "./guestbookRepository";
import { createRsvp, deleteRsvp, findRsvp, getRsvpPolicy, listRsvps, updateRsvp } from "./rsvpRepository";
import { adminNotificationEmailConfigured } from "./adminNotificationEmail";
import { listAdminNotifications, markAdminNotificationsRead } from "./adminNotificationRepository";
import { publishAdminNotification } from "./adminNotificationService";
import { createEditCredential, hashClientKey, hashEditToken, verifyAdminToken } from "./security";
import { parseGuestbookPayload, parseRsvpPayload } from "./validation";
import type { GuestbookOwnedMessage, RsvpRecord } from "@wedding-game/shared";
import type { Env } from "./index";

type WriteLimiter = Pick<MemoryRateLimiter, "allow">;

type HandleApiRequestOptions = {
  limiter?: WriteLimiter;
  waitUntil?: (task: Promise<unknown>) => void;
};

function createWriteLimiter(): MemoryRateLimiter {
  return new MemoryRateLimiter({ limit: 10, windowMs: 60_000 });
}

let writeLimiter: WriteLimiter = createWriteLimiter();

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

function adminJson(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

function adminEmpty(status: number): Response {
  return new Response(null, {
    status,
    headers: { "cache-control": "no-store" }
  });
}

function allowedOrigins(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map((origin) => origin.trim()).filter(Boolean));
}

function isSensitivePath(pathname: string): boolean {
  return /^\/api\/invitations\/[^/]+\/(?:rsvps|guestbook|admin)(?:\/|$)/.test(pathname);
}

function addCorsHeaders(response: Response, origin: string | null, preflight = false): Response {
  response.headers.set("vary", "Origin");
  if (origin) {
    response.headers.set("access-control-allow-origin", origin);
    if (response.headers.has("retry-after")) {
      response.headers.set("access-control-expose-headers", "Retry-After");
    }
    if (preflight) {
      response.headers.set("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
      response.headers.set("access-control-allow-headers", "content-type,authorization");
    }
  }
  return response;
}

function forbidden(): Response {
  return new Response(JSON.stringify({ error: "forbidden" }), {
    status: 403,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "vary": "Origin"
    }
  });
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readExpectedRevision(value: unknown): number | null {
  if (!isRecord(value) || !Number.isInteger(value.revision) || (value.revision as number) < 1) return null;
  return value.revision as number;
}

function readGuestbookModeration(value: unknown): { hidden: boolean; revision: number } | null {
  const revision = readExpectedRevision(value);
  if (!isRecord(value) || typeof value.hidden !== "boolean" || revision === null) return null;
  return { hidden: value.hidden, revision };
}

function readNotificationReadRequest(value: unknown): { notificationIds: string[] | null } | null {
  if (!isRecord(value)) return null;
  if (value.markAll === true) return { notificationIds: null };
  if (
    !Array.isArray(value.notificationIds)
    || value.notificationIds.length < 1
    || value.notificationIds.length > 50
    || !value.notificationIds.every((item) => typeof item === "string" && /^notification_[\w-]+$/.test(item))
  ) return null;

  return { notificationIds: [...new Set(value.notificationIds as string[])] };
}

function readBearerToken(request: Request): string | null {
  const match = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

function hasSecret(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function readAdminPassword(value: unknown): string | null {
  return isRecord(value) && typeof value.password === "string" && value.password.length > 0
    ? value.password
    : null;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

async function ownsRecord(token: string, editTokenHash: string | null): Promise<boolean> {
  if (!editTokenHash) return false;
  return constantTimeEqual(await hashEditToken(token), editTokenHash);
}

function rsvpNotificationBody(response: RsvpRecord): string {
  const side = response.side === "bride" ? "신부측" : response.side === "groom" ? "신랑측" : "구분 없음";
  const attendance = response.attendance === "yes"
    ? "참석"
    : response.attendance === "no" ? "불참" : "미정";
  const party = response.attendance === "no" ? "" : ` · ${response.partySize}명`;
  return `${response.guestName} · ${side} · ${attendance}${party}`;
}

function guestbookNotificationBody(response: GuestbookOwnedMessage): string {
  const message = response.message.length > 90 ? `${response.message.slice(0, 89)}…` : response.message;
  return `${response.nickname} · ${message}`;
}

async function notifyRsvp(
  env: Env,
  invitationId: string,
  response: RsvpRecord,
  kind: "rsvp_created" | "rsvp_updated",
  expiresAt: string | null,
  options: HandleApiRequestOptions
): Promise<void> {
  if (!expiresAt) return;
  await publishAdminNotification(env, {
    invitationId,
    kind,
    sourceId: response.id,
    title: kind === "rsvp_created" ? "새 참석 답변" : "참석 답변 수정",
    body: rsvpNotificationBody(response),
    expiresAt
  }, options.waitUntil);
}

async function notifyGuestbook(
  env: Env,
  invitationId: string,
  response: GuestbookOwnedMessage,
  kind: "guestbook_created" | "guestbook_updated",
  expiresAt: string | null,
  options: HandleApiRequestOptions
): Promise<void> {
  if (!expiresAt) return;
  await publishAdminNotification(env, {
    invitationId,
    kind,
    sourceId: response.id,
    title: kind === "guestbook_created" ? "새 방명록 메시지" : "방명록 메시지 수정",
    body: guestbookNotificationBody(response),
    expiresAt
  }, options.waitUntil);
}

export function resetHttpRateLimiterForTest(): void {
  writeLimiter = createWriteLimiter();
}

async function handleOwnedRsvp(
  request: Request,
  env: Env,
  clientKey: string,
  invitationId: string,
  rsvpId: string,
  options: HandleApiRequestOptions
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PATCH") {
    return json({ error: "not_found" }, 404);
  }

  const token = readBearerToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  try {
    const owned = await findRsvp(env.DB, invitationId, rsvpId);
    if (!owned || !(await ownsRecord(token, owned.editTokenHash))) {
      return json({ error: "unauthorized" }, 401);
    }
    if (request.method === "GET") return json(owned.response);

    const body = await readJson(request);
    const expectedRevision = readExpectedRevision(body);
    if (body === null || expectedRevision === null) return json({ error: "invalid_request" }, 400);

    const policy = await getRsvpPolicy(env.DB, invitationId);
    if (!policy) return json({ error: "not_found" }, 404);
    const submission = parseRsvpPayload(body, policy.consentVersion);
    if (!submission) return json({ error: "invalid_request" }, 400);

    const limiter = options.limiter ?? writeLimiter;
    if (!limiter.allow(clientKey)) return json({ error: "rate_limited" }, 429, { "retry-after": "60" });

    const response = await updateRsvp(env.DB, {
      invitationId,
      rsvpId,
      submission,
      expectedRevision,
      updatedAt: new Date().toISOString()
    });
    if (response) {
      await notifyRsvp(env, invitationId, response, "rsvp_updated", policy.deleteAt, options);
      return json(response);
    }

    const existing = await findRsvp(env.DB, invitationId, rsvpId);
    return existing ? json({ error: "conflict" }, 409) : json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}

async function handleOwnedGuestbook(
  request: Request,
  env: Env,
  clientKey: string,
  invitationId: string,
  guestbookId: string,
  options: HandleApiRequestOptions
): Promise<Response> {
  if (!["GET", "PATCH", "DELETE"].includes(request.method)) {
    return json({ error: "not_found" }, 404);
  }

  const token = readBearerToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  try {
    const owned = await findGuestbook(env.DB, invitationId, guestbookId);
    if (!owned || !(await ownsRecord(token, owned.editTokenHash))) {
      return json({ error: "unauthorized" }, 401);
    }
    if (request.method === "GET") return json(owned.response);

    const limiter = options.limiter ?? writeLimiter;
    if (!limiter.allow(clientKey)) return json({ error: "rate_limited" }, 429, { "retry-after": "60" });

    if (request.method === "DELETE") {
      return await deleteGuestbook(env.DB, invitationId, guestbookId)
        ? new Response(null, { status: 204 })
        : json({ error: "not_found" }, 404);
    }

    const body = await readJson(request);
    const expectedRevision = readExpectedRevision(body);
    if (body === null || expectedRevision === null) return json({ error: "invalid_request" }, 400);
    const submission = parseGuestbookPayload(body);
    if (!submission) return json({ error: "invalid_request" }, 400);

    const response = await updateGuestbook(env.DB, {
      invitationId,
      guestbookId,
      submission,
      expectedRevision,
      updatedAt: new Date().toISOString()
    });
    if (response) {
      try {
        const deleteAt = await getGuestbookDeleteAt(env.DB, invitationId);
        await notifyGuestbook(env, invitationId, response, "guestbook_updated", deleteAt ?? null, options);
      } catch {
        console.error(JSON.stringify({ event: "admin_notification_policy_lookup_failed", kind: "guestbook_updated" }));
      }
      return json(response);
    }

    const existing = await findGuestbook(env.DB, invitationId, guestbookId);
    return existing ? json({ error: "conflict" }, 409) : json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}

async function handleAdminSession(
  request: Request,
  env: Env,
  clientKey: string,
  invitationId: string
): Promise<Response> {
  if (request.method !== "POST") return adminJson({ error: "not_found" }, 404);
  if (
    !hasSecret(env.RSVP_ADMIN_PASSWORD_HASH)
    || !hasSecret(env.RSVP_ADMIN_SESSION_SECRET)
    || !hasSecret(env.RSVP_CLIENT_KEY_SECRET)
  ) return adminJson({ error: "internal_error" }, 500);

  const password = readAdminPassword(await readJson(request));
  if (!password) return adminJson({ error: "invalid_request" }, 400);

  try {
    const result = await attemptAdminLogin(env.DB, {
      invitationId,
      clientKey,
      password,
      passwordHash: env.RSVP_ADMIN_PASSWORD_HASH,
      sessionSecret: env.RSVP_ADMIN_SESSION_SECRET,
      clientKeySecret: env.RSVP_CLIENT_KEY_SECRET,
      now: Date.now()
    });
    if (!result.ok) {
      return result.reason === "rate_limited"
        ? adminJson({ error: "rate_limited" }, 429, { "retry-after": String(result.retryAfterSeconds) })
        : adminJson({ error: "unauthorized" }, 401);
    }
    return adminJson({ token: result.token, expiresAt: result.expiresAt });
  } catch {
    return adminJson({ error: "internal_error" }, 500);
  }
}

async function authenticateAdmin(request: Request, env: Env, invitationId: string): Promise<boolean | null> {
  const token = readBearerToken(request);
  if (!token) return false;
  if (!hasSecret(env.RSVP_ADMIN_SESSION_SECRET)) return null;
  return (await verifyAdminToken(token, env.RSVP_ADMIN_SESSION_SECRET, invitationId, Date.now())) !== null;
}

async function handleAdminRsvps(
  request: Request,
  env: Env,
  invitationId: string,
  rsvpId?: string
): Promise<Response> {
  if ((!rsvpId && request.method !== "GET") || (rsvpId && !["PATCH", "DELETE"].includes(request.method))) {
    return adminJson({ error: "not_found" }, 404);
  }

  try {
    const authenticated = await authenticateAdmin(request, env, invitationId);
    if (authenticated === null) return adminJson({ error: "internal_error" }, 500);
    if (!authenticated) return adminJson({ error: "unauthorized" }, 401);

    if (!rsvpId) return adminJson(await listRsvps(env.DB, invitationId));
    if (request.method === "DELETE") {
      return await deleteRsvp(env.DB, invitationId, rsvpId)
        ? adminEmpty(204)
        : adminJson({ error: "not_found" }, 404);
    }

    const existing = await findRsvp(env.DB, invitationId, rsvpId);
    if (!existing) return adminJson({ error: "not_found" }, 404);
    if (
      existing.response.side === "legacy"
      || !existing.response.phone
      || !existing.response.consentVersion
    ) return adminJson({ error: "legacy_read_only" }, 409);

    const body = await readJson(request);
    const expectedRevision = readExpectedRevision(body);
    if (body === null || expectedRevision === null || !isRecord(body)) {
      return adminJson({ error: "invalid_request" }, 400);
    }
    const submission = parseRsvpPayload(
      { ...body, consentVersion: existing.response.consentVersion },
      existing.response.consentVersion
    );
    if (!submission) return adminJson({ error: "invalid_request" }, 400);

    const updated = await updateRsvp(env.DB, {
      invitationId,
      rsvpId,
      submission,
      expectedRevision,
      updatedAt: new Date().toISOString()
    });
    if (updated) return adminJson(updated);

    return await findRsvp(env.DB, invitationId, rsvpId)
      ? adminJson({ error: "conflict" }, 409)
      : adminJson({ error: "not_found" }, 404);
  } catch {
    return adminJson({ error: "internal_error" }, 500);
  }
}

async function handleAdminGuestbook(
  request: Request,
  env: Env,
  invitationId: string,
  guestbookId?: string
): Promise<Response> {
  if ((!guestbookId && request.method !== "GET") || (guestbookId && !["PATCH", "DELETE"].includes(request.method))) {
    return adminJson({ error: "not_found" }, 404);
  }

  try {
    const authenticated = await authenticateAdmin(request, env, invitationId);
    if (authenticated === null) return adminJson({ error: "internal_error" }, 500);
    if (!authenticated) return adminJson({ error: "unauthorized" }, 401);

    if (!guestbookId) return adminJson(await listAdminGuestbook(env.DB, invitationId));
    if (request.method === "DELETE") {
      return await deleteGuestbook(env.DB, invitationId, guestbookId)
        ? adminEmpty(204)
        : adminJson({ error: "not_found" }, 404);
    }

    const body = await readJson(request);
    const expectedRevision = readExpectedRevision(body);
    if (body === null || expectedRevision === null) return adminJson({ error: "invalid_request" }, 400);
    const moderation = readGuestbookModeration(body);
    const submission = moderation ? null : parseGuestbookPayload(body);
    if (!moderation && !submission) return adminJson({ error: "invalid_request" }, 400);
    const updated = moderation
      ? await moderateGuestbook(env.DB, {
        invitationId,
        guestbookId,
        hidden: moderation.hidden,
        expectedRevision,
        updatedAt: new Date().toISOString()
      })
      : submission && await updateGuestbook(env.DB, {
        invitationId,
        guestbookId,
        submission,
        expectedRevision,
        updatedAt: new Date().toISOString()
      });
    if (updated) return adminJson(updated);

    const existing = await findGuestbook(env.DB, invitationId, guestbookId);
    return existing ? adminJson({ error: "conflict" }, 409) : adminJson({ error: "not_found" }, 404);
  } catch {
    return adminJson({ error: "internal_error" }, 500);
  }
}

async function handleAdminNotifications(
  request: Request,
  env: Env,
  invitationId: string
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PATCH") {
    return adminJson({ error: "not_found" }, 404);
  }

  try {
    const authenticated = await authenticateAdmin(request, env, invitationId);
    if (authenticated === null) return adminJson({ error: "internal_error" }, 500);
    if (!authenticated) return adminJson({ error: "unauthorized" }, 401);

    if (request.method === "PATCH") {
      const payload = readNotificationReadRequest(await readJson(request));
      if (!payload) return adminJson({ error: "invalid_request" }, 400);
      await markAdminNotificationsRead(
        env.DB,
        invitationId,
        payload.notificationIds,
        new Date().toISOString()
      );
    }

    return adminJson(await listAdminNotifications(
      env.DB,
      invitationId,
      adminNotificationEmailConfigured(env)
    ));
  } catch {
    return adminJson({ error: "internal_error" }, 500);
  }
}

async function handleGuestbookCollection(
  request: Request,
  env: Env,
  clientKey: string,
  invitationId: string,
  options: HandleApiRequestOptions
): Promise<Response> {
  if (request.method === "GET") {
    const cursorValue = new URL(request.url).searchParams.get("cursor");
    const cursor = cursorValue === null ? null : decodeGuestbookCursor(cursorValue);
    if (cursorValue !== null && !cursor) return json({ error: "invalid_request" }, 400);

    try {
      const deleteAt = await getGuestbookDeleteAt(env.DB, invitationId);
      if (deleteAt === undefined) return json({ error: "not_found" }, 404);
      if (!deleteAt) return json({ error: "internal_error" }, 500);
      return json(await listGuestbookPage(env.DB, invitationId, cursor));
    } catch {
      return json({ error: "internal_error" }, 500);
    }
  }

  if (request.method !== "POST") return json({ error: "not_found" }, 404);
  const body = await readJson(request);
  if (body === null) return json({ error: "invalid_request" }, 400);
  const submission = parseGuestbookPayload(body);
  if (!submission) return json({ error: "invalid_request" }, 400);
  if (!hasSecret(env.RSVP_CLIENT_KEY_SECRET)) return json({ error: "internal_error" }, 500);

  try {
    const deleteAt = await getGuestbookDeleteAt(env.DB, invitationId);
    if (deleteAt === undefined) return json({ error: "not_found" }, 404);
    if (!deleteAt) return json({ error: "internal_error" }, 500);

    const limiter = options.limiter ?? writeLimiter;
    if (!limiter.allow(clientKey)) return json({ error: "rate_limited" }, 429, { "retry-after": "60" });

    const now = new Date();
    const clientHash = await hashClientKey(clientKey, env.RSVP_CLIENT_KEY_SECRET);
    const windowMs = 10 * 60 * 1_000;
    const recent = await countRecentGuestbookWrites(
      env.DB,
      invitationId,
      clientHash,
      new Date(now.getTime() - windowMs).toISOString()
    );
    if (recent.count >= 3) {
      const oldestTime = recent.oldestCreatedAt ? Date.parse(recent.oldestCreatedAt) : Number.NaN;
      const retryAfter = Number.isFinite(oldestTime)
        ? Math.max(1, Math.ceil((oldestTime + windowMs - now.getTime()) / 1_000))
        : 600;
      return json({ error: "rate_limited" }, 429, { "retry-after": String(retryAfter) });
    }

    const guestbookId = id("guestbook");
    const credential = await createEditCredential();
    const response = await createGuestbook(env.DB, {
      id: guestbookId,
      invitationId,
      submission,
      clientHash,
      editTokenHash: credential.editTokenHash,
      createdAt: now.toISOString()
    });

    await notifyGuestbook(env, invitationId, response, "guestbook_created", deleteAt, options);

    return json({
      response,
      credential: { guestbookId, editToken: credential.editToken }
    }, 201);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}

async function handleApiRequestWithoutCors(
  request: Request,
  env: Env,
  clientKey: string,
  options: HandleApiRequestOptions = {}
): Promise<Response> {
  const url = new URL(request.url);
  const adminSessionMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/admin\/session$/);
  if (adminSessionMatch) return handleAdminSession(request, env, clientKey, adminSessionMatch[1]);

  const adminNotificationsMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/admin\/notifications$/);
  if (adminNotificationsMatch) return handleAdminNotifications(request, env, adminNotificationsMatch[1]);

  const adminRsvpMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/admin\/rsvps(?:\/([^/]+))?$/);
  if (adminRsvpMatch) return handleAdminRsvps(request, env, adminRsvpMatch[1], adminRsvpMatch[2]);

  const adminGuestbookMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/admin\/guestbook(?:\/([^/]+))?$/);
  if (adminGuestbookMatch) {
    return handleAdminGuestbook(request, env, adminGuestbookMatch[1], adminGuestbookMatch[2]);
  }

  const ownedRsvpMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/rsvps\/([^/]+)$/);
  if (ownedRsvpMatch) {
    return handleOwnedRsvp(request, env, clientKey, ownedRsvpMatch[1], ownedRsvpMatch[2], options);
  }

  const ownedGuestbookMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/guestbook\/([^/]+)$/);
  if (ownedGuestbookMatch) {
    return handleOwnedGuestbook(request, env, clientKey, ownedGuestbookMatch[1], ownedGuestbookMatch[2], options);
  }

  const collectionMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/(rsvps|guestbook)$/);
  if (!collectionMatch) return json({ error: "not_found" }, 404);

  const [, invitationId, resource] = collectionMatch;
  if (resource === "guestbook") return handleGuestbookCollection(request, env, clientKey, invitationId, options);

  if (request.method !== "POST") return json({ error: "not_found" }, 404);

  const body = await readJson(request);
  if (body === null) return json({ error: "invalid_request" }, 400);

  if (resource === "rsvps") {
    try {
      const policy = await getRsvpPolicy(env.DB, invitationId);
      if (!policy) return json({ error: "not_found" }, 404);

      const submission = parseRsvpPayload(body, policy.consentVersion);
      if (!submission) return json({ error: "invalid_request" }, 400);

      const limiter = options.limiter ?? writeLimiter;
      if (!limiter.allow(clientKey)) return json({ error: "rate_limited" }, 429, { "retry-after": "60" });

      const rsvpId = id("rsvp");
      const credential = await createEditCredential();
      const response = await createRsvp(env.DB, {
        id: rsvpId,
        invitationId,
        submission,
        consentedAt: new Date().toISOString(),
        editTokenHash: credential.editTokenHash
      });

      await notifyRsvp(env, invitationId, response, "rsvp_created", policy.deleteAt, options);

      return json({
        response,
        credential: { rsvpId, editToken: credential.editToken }
      }, 201);
    } catch {
      return json({ error: "internal_error" }, 500);
    }
  }

  return json({ error: "not_found" }, 404);
}

export async function handleApiRequest(
  request: Request,
  env: Env,
  clientKey: string,
  options: HandleApiRequestOptions = {}
): Promise<Response> {
  const { pathname } = new URL(request.url);
  const origin = request.headers.get("origin");
  const sensitive = isSensitivePath(pathname);

  if (origin && !allowedOrigins(env.RSVP_ALLOWED_ORIGINS).has(origin)) {
    return forbidden();
  }

  if (request.method === "OPTIONS") {
    return addCorsHeaders(new Response(null, {
      status: 204,
      headers: {
        ...(sensitive ? { "cache-control": "no-store" } : {})
      }
    }), origin, true);
  }

  const response = await handleApiRequestWithoutCors(request, env, clientKey, options);
  if (sensitive) response.headers.set("cache-control", "no-store");
  return addCorsHeaders(response, origin);
}
