import {
  parsePhotoFrameGallerySubmission,
  type PhotoFrameGalleryStatus
} from "@wedding-game/shared";
import type { Env } from "./index";
import { hashClientKey, verifyAdminToken } from "./security";
import {
  createPhotoFrameGallerySubmission,
  listAdminPhotoFrameGallery,
  listApprovedPhotoFrameGallery,
  moderatePhotoFrameGallerySubmission
} from "./photoFrameGalleryRepository";

function json(body: unknown, status = 200, cacheControl = "no-store", headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cacheControl, ...headers }
  });
}

async function readJson(request: Request): Promise<unknown | null> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 8_192) return null;
  try { return await request.json(); } catch { return null; }
}

function bearer(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1] ?? null;
}

export async function handlePublicPhotoFrameGalleryRequest(
  request: Request,
  env: Env,
  clientKey: string,
  invitationId: string
): Promise<Response> {
  try {
    if (request.method === "GET") {
      const items = await listApprovedPhotoFrameGallery(env.DB, invitationId);
      return items
        ? json({ items, generatedAt: new Date().toISOString() }, 200, "public, max-age=30, stale-while-revalidate=120")
        : json({ error: "not_found" }, 404, "public, max-age=30");
    }
    if (request.method !== "POST") return json({ error: "not_found" }, 404);
    if (!env.RSVP_CLIENT_KEY_SECRET) return json({ error: "internal_error" }, 500);
    const input = parsePhotoFrameGallerySubmission(await readJson(request));
    if (!input) return json({ error: "invalid_request" }, 400);
    const result = await createPhotoFrameGallerySubmission(env.DB, {
      invitationId,
      clientHash: await hashClientKey(clientKey, env.RSVP_CLIENT_KEY_SECRET),
      ...input
    });
    if (result === "not_found") return json({ error: "not_found" }, 404);
    if (result === "rate_limited") return json({ error: "rate_limited" }, 429, "no-store", { "retry-after": "86400" });
    return json(result, 201);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}

export async function handleAdminPhotoFrameGalleryRequest(
  request: Request,
  env: Env,
  invitationId: string,
  submissionId?: string
): Promise<Response> {
  try {
    const token = bearer(request);
    if (!token) return json({ error: "unauthorized" }, 401);
    if (!env.RSVP_ADMIN_SESSION_SECRET) return json({ error: "internal_error" }, 500);
    if (!await verifyAdminToken(token, env.RSVP_ADMIN_SESSION_SECRET, invitationId, Date.now())) {
      return json({ error: "unauthorized" }, 401);
    }
    if (!submissionId) {
      if (request.method !== "GET") return json({ error: "not_found" }, 404);
      const result = await listAdminPhotoFrameGallery(env.DB, invitationId);
      return result ? json(result) : json({ error: "not_found" }, 404);
    }
    if (request.method !== "PATCH") return json({ error: "not_found" }, 404);
    const value = await readJson(request) as { status?: unknown } | null;
    const status = value?.status;
    if (status !== "approved" && status !== "rejected") return json({ error: "invalid_request" }, 400);
    const result = await moderatePhotoFrameGallerySubmission(env.DB, {
      invitationId,
      submissionId,
      status: status as Exclude<PhotoFrameGalleryStatus, "pending">
    });
    return result ? json(result) : json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}
