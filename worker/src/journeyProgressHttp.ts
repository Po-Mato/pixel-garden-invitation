import { validInvitationInviteToken } from "@wedding-game/shared";
import type { Env } from "./index";
import { loadJourneyProgress, mergeJourneyProgress } from "./journeyProgressRepository";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function completedIds(value: unknown): string[] | null {
  if (!value || typeof value !== "object" || !("completedIds" in value) || !Array.isArray(value.completedIds)) return null;
  return value.completedIds.every((id) => typeof id === "string") ? value.completedIds : null;
}

export async function handleJourneyProgressRequest(
  request: Request,
  env: Env,
  invitationId: string
): Promise<Response> {
  const token = request.headers.get("x-invite-token") ?? "";
  if (!validInvitationInviteToken(token)) return json({ error: "not_found" }, 404);
  try {
    if (request.method === "GET") {
      const progress = await loadJourneyProgress(env.DB, invitationId, token);
      return progress ? json(progress) : json({ error: "not_found" }, 404);
    }
    if (request.method === "PUT") {
      let body: unknown;
      try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
      const ids = completedIds(body);
      if (!ids) return json({ error: "invalid_request" }, 400);
      const progress = await mergeJourneyProgress(env.DB, invitationId, token, ids);
      return progress ? json(progress) : json({ error: "not_found" }, 404);
    }
    return json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}
