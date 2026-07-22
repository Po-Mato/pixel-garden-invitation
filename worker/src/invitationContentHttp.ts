import {
  editableInvitationContentPublishIssues,
  parseEditableInvitationContent
} from "@wedding-game/shared";
import {
  getAdminInvitationContent,
  getPublicInvitationContent,
  publishInvitationContent,
  restoreInvitationContentVersion,
  saveInvitationContentDraft,
  type ContentWriteResult
} from "./invitationContentRepository";
import { verifyAdminToken } from "./security";
import type { Env } from "./index";

type AdminContentAction = "content" | "publish" | "restore";
type LimitedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "invalid_request" | "payload_too_large" };

const maxContentPayloadBytes = 70 * 1024;

function responseJson(body: unknown, status = 200, cacheControl = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRevision(value: unknown, allowZero = false): number | null {
  if (!isRecord(value) || !Number.isInteger(value.revision)) return null;
  const revision = value.revision as number;
  return revision >= (allowZero ? 0 : 1) ? revision : null;
}

function readBearerToken(request: Request): string | null {
  return request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1] ?? null;
}

async function readLimitedJson(request: Request): Promise<LimitedJsonResult> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxContentPayloadBytes) {
    return { ok: false, reason: "payload_too_large" };
  }
  if (!request.body) return { ok: false, reason: "invalid_request" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxContentPayloadBytes) {
        await reader.cancel();
        return { ok: false, reason: "payload_too_large" };
      }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(body)) as unknown };
  } catch {
    return { ok: false, reason: "invalid_request" };
  } finally {
    reader.releaseLock();
  }
}

async function authenticated(request: Request, env: Env, invitationId: string): Promise<boolean | null> {
  const token = readBearerToken(request);
  if (!token) return false;
  if (!env.RSVP_ADMIN_SESSION_SECRET) return null;
  return (await verifyAdminToken(token, env.RSVP_ADMIN_SESSION_SECRET, invitationId, Date.now())) !== null;
}

function writeResultResponse(result: ContentWriteResult): Response {
  if (result.ok) return responseJson(result.result);
  return result.reason === "not_found"
    ? responseJson({ error: "not_found" }, 404)
    : responseJson({ error: "conflict" }, 409);
}

export async function handlePublicInvitationContentRequest(
  request: Request,
  env: Env,
  invitationId: string
): Promise<Response> {
  if (request.method !== "GET") return responseJson({ error: "not_found" }, 404);
  try {
    const result = await getPublicInvitationContent(env.DB, invitationId);
    return result
      ? responseJson(result, 200, "public, max-age=60, stale-while-revalidate=300")
      : responseJson({ error: "not_found" }, 404, "public, max-age=60");
  } catch {
    return responseJson({ error: "internal_error" }, 500);
  }
}

export async function handleAdminInvitationContentRequest(
  request: Request,
  env: Env,
  invitationId: string,
  action: AdminContentAction
): Promise<Response> {
  try {
    const authorized = await authenticated(request, env, invitationId);
    if (authorized === null) return responseJson({ error: "internal_error" }, 500);
    if (!authorized) return responseJson({ error: "unauthorized" }, 401);

    if (action === "content" && request.method === "GET") {
      const result = await getAdminInvitationContent(env.DB, invitationId);
      return result ? responseJson(result) : responseJson({ error: "not_found" }, 404);
    }
    if (
      (action === "content" && request.method !== "PATCH")
      || (action !== "content" && request.method !== "POST")
    ) return responseJson({ error: "not_found" }, 404);

    const bodyResult = await readLimitedJson(request);
    if (!bodyResult.ok) return responseJson({ error: bodyResult.reason }, bodyResult.reason === "payload_too_large" ? 413 : 400);
    const body = bodyResult.value;

    if (action === "content") {
      const revision = readRevision(body, true);
      const content = isRecord(body) ? parseEditableInvitationContent(body.content) : null;
      if (revision === null || !content) return responseJson({ error: "invalid_request" }, 400);
      return writeResultResponse(await saveInvitationContentDraft(env.DB, {
        invitationId,
        content,
        expectedRevision: revision,
        historyId: `content_${crypto.randomUUID()}`,
        now: new Date().toISOString()
      }));
    }

    const revision = readRevision(body);
    if (revision === null) return responseJson({ error: "invalid_request" }, 400);

    if (action === "publish") {
      const current = await getAdminInvitationContent(env.DB, invitationId);
      if (!current) return responseJson({ error: "not_found" }, 404);
      if (current.revision !== revision) return responseJson({ error: "conflict" }, 409);
      if (!current.draft) return responseJson({ error: "draft_missing" }, 409);
      const issues = editableInvitationContentPublishIssues(current.draft);
      if (issues.length > 0) return responseJson({ error: "content_incomplete", issues }, 409);
      return writeResultResponse(await publishInvitationContent(env.DB, {
        invitationId,
        expectedRevision: revision,
        historyId: `content_${crypto.randomUUID()}`,
        now: new Date().toISOString()
      }));
    }

    const versionId = isRecord(body) && typeof body.versionId === "string" && /^content_[\w-]+$/.test(body.versionId)
      ? body.versionId
      : null;
    if (!versionId) return responseJson({ error: "invalid_request" }, 400);
    return writeResultResponse(await restoreInvitationContentVersion(env.DB, {
      invitationId,
      versionId,
      expectedRevision: revision,
      historyId: `content_${crypto.randomUUID()}`,
      now: new Date().toISOString()
    }));
  } catch {
    return responseJson({ error: "internal_error" }, 500);
  }
}
