import { verifyAdminToken } from "./security";
import type { Env } from "./index";
import { listRsvpHistory } from "./rsvpHistoryRepository";

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

export async function handleAdminRsvpHistoryRequest(
  request: Request,
  env: Env,
  invitationId: string,
  rsvpId: string
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "not_found" }, 404);
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
    const history = await listRsvpHistory(env.DB, invitationId, rsvpId);
    return history ? json(history) : json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}
