import { findRsvp } from "./rsvpRepository";
import { hashEditToken, verifyAdminToken } from "./security";
import type { Env } from "./index";
import { listRsvpHistory, restoreRsvpHistory } from "./rsvpHistoryRepository";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
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

export async function handleAdminRsvpHistoryRequest(
  request: Request,
  env: Env,
  invitationId: string,
  rsvpId: string
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "not_found" }, 404);
  const token = bearerToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);
  if (!env.RSVP_ADMIN_SESSION_SECRET) return json({ error: "internal_error" }, 500);

  try {
    const authenticated = await verifyAdminToken(
      token,
      env.RSVP_ADMIN_SESSION_SECRET,
      invitationId,
      Date.now()
    );
    if (!authenticated) return json({ error: "unauthorized" }, 401);
    if (request.method === "POST") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      if (!body || typeof body !== "object") return json({ error: "invalid_request" }, 400);
      const candidate = body as Record<string, unknown>;
      const reason = typeof candidate.reason === "string" ? candidate.reason.trim() : "";
      if (
        !Number.isInteger(candidate.targetRevision)
        || !Number.isInteger(candidate.currentRevision)
        || (candidate.targetRevision as number) < 1
        || (candidate.currentRevision as number) < 1
        || (candidate.targetRevision as number) >= (candidate.currentRevision as number)
        || reason.length < 2
        || reason.length > 120
      ) return json({ error: "invalid_request" }, 400);

      const restored = await restoreRsvpHistory(
        env.DB,
        invitationId,
        rsvpId,
        candidate.targetRevision as number,
        candidate.currentRevision as number,
        reason
      );
      if (restored.status === "not_found") return json({ error: "not_found" }, 404);
      if (restored.status === "conflict") return json({ error: "revision_conflict" }, 409);
    }
    const history = await listRsvpHistory(env.DB, invitationId, rsvpId);
    return history ? json(history) : json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}

export async function handleOwnedRsvpHistoryRequest(
  request: Request,
  env: Env,
  invitationId: string,
  rsvpId: string
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "not_found" }, 404);
  const token = bearerToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  try {
    const owned = await findRsvp(env.DB, invitationId, rsvpId);
    if (!owned?.editTokenHash) return json({ error: "unauthorized" }, 401);
    const authenticated = constantTimeEqual(await hashEditToken(token), owned.editTokenHash);
    if (!authenticated) return json({ error: "unauthorized" }, 401);
    const history = await listRsvpHistory(env.DB, invitationId, rsvpId);
    return history ? json(history) : json({ error: "unauthorized" }, 401);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}
