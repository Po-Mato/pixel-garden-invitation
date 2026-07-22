import type { Env } from "./index";
import {
  cancelInvitationReleaseSchedule,
  getAdminInvitationRelease,
  getPublicInvitationRelease,
  publishInvitationRelease,
  restoreInvitationRelease,
  scheduleInvitationRelease,
  type ReleaseWriteResult
} from "./invitationReleaseRepository";
import { verifyAdminToken } from "./security";

export type AdminReleaseAction = "releases" | "publish" | "schedule" | "cancel" | "restore";

function responseJson(body: unknown, status = 200, cacheControl = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl
    }
  });
}

export async function handlePublicInvitationReleaseRequest(
  request: Request,
  env: Env,
  invitationId: string
): Promise<Response> {
  if (request.method !== "GET") return responseJson({ error: "not_found" }, 404);
  try {
    const result = await getPublicInvitationRelease(env.DB, invitationId);
    return result
      ? responseJson(result, 200, "public, max-age=60, stale-while-revalidate=300")
      : responseJson({ error: "not_found" }, 404, "public, max-age=60");
  } catch {
    return responseJson({ error: "internal_error" }, 500);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function positiveRevision(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 1 ? value as number : null;
}

async function authenticated(request: Request, env: Env, invitationId: string): Promise<boolean | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1] ?? null;
  if (!token) return false;
  if (!env.RSVP_ADMIN_SESSION_SECRET) return null;
  return (await verifyAdminToken(token, env.RSVP_ADMIN_SESSION_SECRET, invitationId, Date.now())) !== null;
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 4 * 1024) return null;
  try {
    const value = await request.json() as unknown;
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function writeResponse(result: ReleaseWriteResult): Response {
  if (result.ok) return responseJson(result.result);
  if (result.reason === "not_found") return responseJson({ error: "not_found" }, 404);
  if (result.reason === "content_incomplete" || result.reason === "gallery_incomplete") {
    return responseJson({ error: result.reason, issues: result.issues ?? [] }, 409);
  }
  return responseJson({ error: "conflict" }, 409);
}

function releaseIds() {
  return {
    releaseId: `release_${crypto.randomUUID()}`,
    contentHistoryId: `content_${crypto.randomUUID()}`,
    galleryHistoryId: `gallery_${crypto.randomUUID()}`
  };
}

export async function handleAdminInvitationReleaseRequest(
  request: Request,
  env: Env,
  invitationId: string,
  action: AdminReleaseAction
): Promise<Response> {
  try {
    const authorized = await authenticated(request, env, invitationId);
    if (authorized === null) return responseJson({ error: "internal_error" }, 500);
    if (!authorized) return responseJson({ error: "unauthorized" }, 401);

    if (action === "releases") {
      if (request.method !== "GET") return responseJson({ error: "not_found" }, 404);
      const result = await getAdminInvitationRelease(env.DB, invitationId);
      return result ? responseJson(result) : responseJson({ error: "not_found" }, 404);
    }
    if (request.method !== "POST") return responseJson({ error: "not_found" }, 404);

    if (action === "cancel") {
      return writeResponse(await cancelInvitationReleaseSchedule(env.DB, invitationId));
    }

    const body = await readJson(request);
    if (!body) return responseJson({ error: "invalid_request" }, 400);

    if (action === "restore") {
      const sourceReleaseId = typeof body.releaseId === "string"
        && /^release_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.releaseId)
        ? body.releaseId
        : null;
      if (!sourceReleaseId) return responseJson({ error: "invalid_request" }, 400);
      return writeResponse(await restoreInvitationRelease(env.DB, {
        invitationId,
        sourceReleaseId,
        ...releaseIds(),
        now: new Date().toISOString()
      }));
    }

    const contentRevision = positiveRevision(body.contentRevision);
    const galleryRevision = positiveRevision(body.galleryRevision);
    if (contentRevision === null || galleryRevision === null) {
      return responseJson({ error: "invalid_request" }, 400);
    }

    if (action === "publish") {
      return writeResponse(await publishInvitationRelease(env.DB, {
        invitationId,
        expectedContentRevision: contentRevision,
        expectedGalleryRevision: galleryRevision,
        ...releaseIds(),
        now: new Date().toISOString()
      }));
    }

    const scheduledFor = typeof body.scheduledFor === "string" ? new Date(body.scheduledFor) : null;
    const now = new Date();
    if (
      !scheduledFor
      || Number.isNaN(scheduledFor.getTime())
      || scheduledFor.getTime() < now.getTime() + 60_000
      || scheduledFor.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1000
    ) return responseJson({ error: "invalid_schedule" }, 400);
    return writeResponse(await scheduleInvitationRelease(env.DB, {
      invitationId,
      expectedContentRevision: contentRevision,
      expectedGalleryRevision: galleryRevision,
      scheduleId: `schedule_${crypto.randomUUID()}`,
      scheduledFor: scheduledFor.toISOString(),
      now: now.toISOString()
    }));
  } catch {
    return responseJson({ error: "internal_error" }, 500);
  }
}
