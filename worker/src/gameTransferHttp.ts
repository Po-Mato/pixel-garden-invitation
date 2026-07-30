import type { Env } from "./index";
import { hashClientKey } from "./security";
import {
  claimGameTransfer,
  createGameTransfer,
  loadGameTransfer,
  reportGameTransferProgress,
  revokeGameTransfer
} from "./gameTransferRepository";

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

function bearer(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{32,64})$/)?.[1] ?? null;
}

function createInput(value: unknown, now: Date) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { expiresAt?: unknown; entryCount?: unknown };
  if (typeof candidate.expiresAt !== "string" || !Number.isInteger(candidate.entryCount)) return null;
  const expiresAt = new Date(candidate.expiresAt);
  const lifetime = expiresAt.getTime() - now.getTime();
  if (!Number.isFinite(expiresAt.getTime()) || lifetime < 60_000 || lifetime > 16 * 60_000) return null;
  if ((candidate.entryCount as number) < 0 || (candidate.entryCount as number) > 64) return null;
  return { expiresAt: expiresAt.toISOString(), entryCount: candidate.entryCount as number };
}

export async function handleGameTransferRequest(
  request: Request,
  env: Env,
  clientKey: string,
  invitationId: string,
  transferId?: string,
  action?: string
): Promise<Response> {
  if (!env.RSVP_CLIENT_KEY_SECRET) return json({ error: "internal_error" }, 500);
  try {
    if (!transferId) {
      if (request.method !== "POST") return json({ error: "not_found" }, 404);
      let body: unknown;
      try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
      const now = new Date();
      const input = createInput(body, now);
      if (!input) return json({ error: "invalid_request" }, 400);
      const created = await createGameTransfer(env.DB, {
        invitationId,
        clientHash: await hashClientKey(clientKey, env.RSVP_CLIENT_KEY_SECRET),
        ...input
      }, now);
      if (created === "not_found") return json({ error: "not_found" }, 404);
      if (created === "rate_limited") return json({ error: "rate_limited" }, 429, { "retry-after": "3600" });
      return json(created, 201);
    }

    const token = bearer(request);
    if (!token) return json({ error: "not_found" }, 404);
    if (action === "claim") {
      if (request.method !== "POST") return json({ error: "not_found" }, 404);
      const result = await claimGameTransfer(env.DB, invitationId, transferId, token);
      if (!result) return json({ error: "not_found" }, 404);
      return result.changed
        ? json(result.state)
        : json({ error: result.state.status === "expired" ? "transfer_expired" : `transfer_${result.state.status}` }, 409);
    }
    if (action === "progress") {
      if (request.method !== "POST") return json({ error: "not_found" }, 404);
      let body: unknown;
      try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
      const phase = body && typeof body === "object" && "phase" in body ? body.phase : null;
      if (phase !== "opened" && phase !== "previewing" && phase !== "restoring") {
        return json({ error: "invalid_request" }, 400);
      }
      const result = await reportGameTransferProgress(env.DB, invitationId, transferId, token, phase);
      if (!result) return json({ error: "not_found" }, 404);
      return result.changed
        ? json(result.state)
        : json({ error: result.state.status === "expired" ? "transfer_expired" : `transfer_${result.state.status}` }, 409);
    }
    if (action) return json({ error: "not_found" }, 404);
    if (request.method === "GET") {
      const result = await loadGameTransfer(env.DB, invitationId, transferId, token);
      return result ? json(result) : json({ error: "not_found" }, 404);
    }
    if (request.method === "DELETE") {
      const result = await revokeGameTransfer(env.DB, invitationId, transferId, token);
      if (!result) return json({ error: "not_found" }, 404);
      return result.changed
        ? json(result.state)
        : json({ error: result.state.status === "expired" ? "transfer_expired" : `transfer_${result.state.status}` }, 409);
    }
    return json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}
