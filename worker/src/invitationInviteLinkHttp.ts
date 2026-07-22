import {
  parseInvitationInviteLinkBatch,
  parseInvitationInviteDeliveryInput,
  parseInvitationInviteLinkUpdate,
  validInvitationInviteToken
} from "@wedding-game/shared";
import type { Env } from "./index";
import {
  createInvitationInviteLinks,
  deleteInvitationInviteLink,
  listInvitationInviteLinks,
  openInvitationInviteLink,
  recordInvitationInviteLinkDeliveries,
  rotateInvitationInviteLink,
  updateInvitationInviteLink
} from "./invitationInviteLinkRepository";
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

async function body(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function authorized(request: Request, env: Env, invitationId: string): Promise<boolean> {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1] ?? "";
  if (!token || !env.RSVP_ADMIN_SESSION_SECRET) return false;
  return Boolean(await verifyAdminToken(token, env.RSVP_ADMIN_SESSION_SECRET, invitationId, Date.now()));
}

export async function handleAdminInvitationInviteLinkRequest(
  request: Request,
  env: Env,
  invitationId: string,
  linkId?: string,
  action?: "rotate"
): Promise<Response> {
  if (!(await authorized(request, env, invitationId))) return json({ error: "unauthorized" }, 401);
  try {
    if (!linkId && request.method === "GET") {
      const result = await listInvitationInviteLinks(env.DB, invitationId);
      return result ? json(result) : json({ error: "not_found" }, 404);
    }
    if (!linkId && request.method === "POST") {
      const requestBody = await body(request);
      const delivery = typeof requestBody === "object" && requestBody !== null && "delivery" in requestBody
        ? parseInvitationInviteDeliveryInput(requestBody.delivery)
        : null;
      if (delivery) {
        const recorded = await recordInvitationInviteLinkDeliveries(env.DB, invitationId, delivery);
        if (!recorded) return json({ error: "not_found" }, 404);
        const result = await listInvitationInviteLinks(env.DB, invitationId);
        return result ? json(result) : json({ error: "not_found" }, 404);
      }
      const links = parseInvitationInviteLinkBatch(requestBody);
      if (!links) return json({ error: "invalid_request" }, 400);
      const created = await createInvitationInviteLinks(env.DB, invitationId, links);
      if (!created) return json({ error: "not_found" }, 404);
      const result = await listInvitationInviteLinks(env.DB, invitationId);
      return result ? json({ ...result, created }, 201) : json({ error: "not_found" }, 404);
    }
    if (linkId && action === "rotate" && request.method === "POST") {
      const created = await rotateInvitationInviteLink(env.DB, invitationId, linkId);
      if (!created) return json({ error: "not_found" }, 404);
      const result = await listInvitationInviteLinks(env.DB, invitationId);
      return result ? json({ ...result, created: [created] }) : json({ error: "not_found" }, 404);
    }
    if (linkId && !action && request.method === "PATCH") {
      const update = parseInvitationInviteLinkUpdate(await body(request));
      if (!update) return json({ error: "invalid_request" }, 400);
      const link = await updateInvitationInviteLink(env.DB, invitationId, linkId, update);
      return link ? json(link) : json({ error: "not_found" }, 404);
    }
    if (linkId && !action && request.method === "DELETE") {
      return await deleteInvitationInviteLink(env.DB, invitationId, linkId)
        ? new Response(null, { status: 204, headers: { "cache-control": "no-store" } })
        : json({ error: "not_found" }, 404);
    }
    return json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}

export async function handlePublicInvitationInviteLinkRequest(
  request: Request,
  env: Env,
  invitationId: string,
  token: string
): Promise<Response> {
  if (request.method !== "GET" || !validInvitationInviteToken(token)) {
    return json({ error: "not_found" }, 404);
  }
  try {
    const invite = await openInvitationInviteLink(env.DB, invitationId, token);
    return invite ? json(invite) : json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "not_found" }, 404);
  }
}
