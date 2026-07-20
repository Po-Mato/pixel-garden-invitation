import { MemoryRateLimiter } from "./rateLimit";
import { attemptAdminLogin } from "./adminAuth";
import { createRsvp, deleteRsvp, findRsvp, getRsvpPolicy, listRsvps, updateRsvp } from "./rsvpRepository";
import { createEditCredential, hashEditToken, verifyAdminToken } from "./security";
import { parseGuestbookPayload, parseRsvpPayload } from "./validation";
import type { Env } from "./index";

type WriteLimiter = Pick<MemoryRateLimiter, "allow">;

type HandleApiRequestOptions = {
  limiter?: WriteLimiter;
};

type GuestbookRow = {
  id: string;
  nickname: string;
  message: string;
  created_at: string;
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
  return /^\/api\/invitations\/[^/]+\/(?:rsvps|admin)(?:\/|$)/.test(pathname);
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

async function ownsRsvp(token: string, editTokenHash: string | null): Promise<boolean> {
  if (!editTokenHash) return false;
  return constantTimeEqual(await hashEditToken(token), editTokenHash);
}

export function resetHttpRateLimiterForTest(): void {
  writeLimiter = createWriteLimiter();
}

async function invitationExists(db: D1Database, invitationId: string): Promise<boolean> {
  const invitation = await db
    .prepare("SELECT id FROM invitations WHERE id = ?")
    .bind(invitationId)
    .first<{ id: string }>();

  return invitation !== null;
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
    if (!owned || !(await ownsRsvp(token, owned.editTokenHash))) {
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
    if (response) return json(response);

    const existing = await findRsvp(env.DB, invitationId, rsvpId);
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
  const expectedMethod = rsvpId ? "DELETE" : "GET";
  if (request.method !== expectedMethod) return adminJson({ error: "not_found" }, 404);

  try {
    const authenticated = await authenticateAdmin(request, env, invitationId);
    if (authenticated === null) return adminJson({ error: "internal_error" }, 500);
    if (!authenticated) return adminJson({ error: "unauthorized" }, 401);

    if (!rsvpId) return adminJson(await listRsvps(env.DB, invitationId));
    return await deleteRsvp(env.DB, invitationId, rsvpId)
      ? adminEmpty(204)
      : adminJson({ error: "not_found" }, 404);
  } catch {
    return adminJson({ error: "internal_error" }, 500);
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

  const adminRsvpMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/admin\/rsvps(?:\/([^/]+))?$/);
  if (adminRsvpMatch) return handleAdminRsvps(request, env, adminRsvpMatch[1], adminRsvpMatch[2]);

  const ownedRsvpMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/rsvps\/([^/]+)$/);
  if (ownedRsvpMatch) {
    return handleOwnedRsvp(request, env, clientKey, ownedRsvpMatch[1], ownedRsvpMatch[2], options);
  }

  const collectionMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/(rsvps|guestbook)$/);
  if (!collectionMatch) return json({ error: "not_found" }, 404);

  const [, invitationId, resource] = collectionMatch;
  if (request.method === "GET" && resource === "guestbook") {
    try {
      if (!(await invitationExists(env.DB, invitationId))) return json({ error: "not_found" }, 404);

      const result = await env.DB
        .prepare(`
          SELECT id, nickname, message, created_at
          FROM guestbook_messages
          WHERE invitation_id = ? AND is_hidden = 0
          ORDER BY created_at DESC
        `)
        .bind(invitationId)
        .all<GuestbookRow>();

      return json({
        messages: (result.results ?? []).map((row) => ({
          id: row.id,
          nickname: row.nickname,
          message: row.message,
          createdAt: row.created_at
        }))
      });
    } catch {
      return json({ error: "internal_error" }, 500);
    }
  }

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

      return json({
        response,
        credential: { rsvpId, editToken: credential.editToken }
      }, 201);
    } catch {
      return json({ error: "internal_error" }, 500);
    }
  }

  const payload = parseGuestbookPayload(body);
  if (!payload) return json({ error: "invalid_request" }, 400);

  try {
    if (!(await invitationExists(env.DB, invitationId))) return json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }

  const limiter = options.limiter ?? writeLimiter;
  if (!limiter.allow(clientKey)) return json({ error: "rate_limited" }, 429);

  try {
    await env.DB
      .prepare(`
        INSERT INTO guestbook_messages (id, invitation_id, nickname, message)
        VALUES (?, ?, ?, ?)
      `)
      .bind(id("guestbook"), invitationId, payload.nickname, payload.message)
      .run();
  } catch {
    return json({ error: "internal_error" }, 500);
  }

  return json({ ok: true }, 201);
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
