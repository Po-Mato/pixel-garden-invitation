import {
  parseGuestAnnouncementInput,
  parseGuestAnnouncementViewIds,
  parseGuestFaqInput,
  parseGuestInformationCreateInput
} from "@wedding-game/shared";
import type { Env } from "./index";
import {
  createGuestAnnouncement,
  createGuestFaq,
  deleteGuestInformationItem,
  getGuestInformationAdmin,
  getPublishedGuestInformation,
  recordGuestAnnouncementViews,
  updateGuestAnnouncement,
  updateGuestFaq
} from "./guestInformationRepository";
import { verifyAdminToken } from "./security";

function json(body: unknown, status = 200, cacheControl = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl
    }
  });
}

async function readBody(request: Request): Promise<unknown | null> {
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

export async function handleAdminGuestInformationRequest(
  request: Request,
  env: Env,
  invitationId: string,
  kind?: "announcements" | "faqs",
  itemId?: string
): Promise<Response> {
  if (!(await authorized(request, env, invitationId))) return json({ error: "unauthorized" }, 401);
  try {
    if (!kind && !itemId && request.method === "GET") {
      const result = await getGuestInformationAdmin(env.DB, invitationId);
      return result ? json(result) : json({ error: "not_found" }, 404);
    }
    if (!kind && !itemId && request.method === "POST") {
      const input = parseGuestInformationCreateInput(await readBody(request));
      if (!input) return json({ error: "invalid_request" }, 400);
      let created;
      if (input.kind === "announcement") {
        created = await createGuestAnnouncement(env.DB, invitationId, input.input);
      } else {
        created = await createGuestFaq(env.DB, invitationId, input.input);
      }
      return created ? json(created, 201) : json({ error: "not_found" }, 404);
    }
    if (kind && itemId && request.method === "PATCH") {
      const value = await readBody(request);
      let updated;
      if (kind === "announcements") {
        const input = parseGuestAnnouncementInput(value);
        if (!input) return json({ error: "invalid_request" }, 400);
        updated = await updateGuestAnnouncement(env.DB, invitationId, itemId, input);
      } else {
        const input = parseGuestFaqInput(value);
        if (!input) return json({ error: "invalid_request" }, 400);
        updated = await updateGuestFaq(env.DB, invitationId, itemId, input);
      }
      return updated ? json(updated) : json({ error: "not_found" }, 404);
    }
    if (kind && itemId && request.method === "DELETE") {
      return await deleteGuestInformationItem(env.DB, invitationId, kind, itemId)
        ? new Response(null, { status: 204, headers: { "cache-control": "no-store" } })
        : json({ error: "not_found" }, 404);
    }
    return json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}

export async function handlePublicGuestInformationRequest(
  request: Request,
  env: Env,
  invitationId: string,
  action?: "views"
): Promise<Response> {
  try {
    if (!action && request.method === "GET") {
      const result = await getPublishedGuestInformation(env.DB, invitationId);
      return result
        ? json(result, 200, "public, max-age=60, stale-while-revalidate=300")
        : json({ error: "not_found" }, 404);
    }
    if (action === "views" && request.method === "POST") {
      const ids = parseGuestAnnouncementViewIds(await readBody(request));
      if (!ids) return json({ error: "invalid_request" }, 400);
      await recordGuestAnnouncementViews(env.DB, invitationId, ids);
      return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }
    return json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}
