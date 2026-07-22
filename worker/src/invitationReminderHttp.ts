import { parseInvitationReminderDeliveryInput } from "@wedding-game/shared";
import type { Env } from "./index";
import { listInvitationReminders, recordInvitationReminders } from "./invitationReminderRepository";
import { verifyAdminToken } from "./security";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function authorized(request: Request, env: Env, invitationId: string): Promise<boolean> {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1] ?? "";
  if (!token || !env.RSVP_ADMIN_SESSION_SECRET) return false;
  return Boolean(await verifyAdminToken(token, env.RSVP_ADMIN_SESSION_SECRET, invitationId, Date.now()));
}

async function readBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleAdminInvitationReminderRequest(
  request: Request,
  env: Env,
  invitationId: string
): Promise<Response> {
  if (!(await authorized(request, env, invitationId))) return json({ error: "unauthorized" }, 401);
  try {
    if (request.method === "GET") {
      const result = await listInvitationReminders(env.DB, invitationId);
      return result ? json(result) : json({ error: "not_found" }, 404);
    }
    if (request.method === "POST") {
      const input = parseInvitationReminderDeliveryInput(await readBody(request));
      if (!input) return json({ error: "invalid_request" }, 400);
      if (!(await recordInvitationReminders(env.DB, invitationId, input))) {
        return json({ error: "not_found" }, 404);
      }
      const result = await listInvitationReminders(env.DB, invitationId);
      return result ? json(result, 201) : json({ error: "not_found" }, 404);
    }
    return json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}
