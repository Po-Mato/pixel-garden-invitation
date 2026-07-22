import {
  editableInvitationGalleryPublishIssues,
  parseEditableInvitationGallery,
  weddingContent,
  type EditableInvitationGallery
} from "@wedding-game/shared";
import {
  getAdminInvitationGallery,
  getPublicInvitationGallery,
  isPublishedGalleryAsset,
  publishInvitationGallery,
  restoreInvitationGalleryVersion,
  saveInvitationGalleryDraft,
  type GalleryWriteResult
} from "./invitationGalleryRepository";
import { verifyAdminToken } from "./security";
import type { Env } from "./index";

type AdminGalleryAction = "gallery" | "publish" | "restore";
type GalleryWidth = 640 | 1024;
type LimitedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "invalid_request" | "payload_too_large" };

const maxGalleryPayloadBytes = 36 * 1024;
const maxImageBytes: Record<GalleryWidth, number> = { 640: 1_500_000, 1024: 3_000_000 };
const assetIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const slotIds = new Set(weddingContent.gallery.map((photo) => photo.id));

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

async function authenticated(request: Request, env: Env, invitationId: string): Promise<boolean | null> {
  const token = readBearerToken(request);
  if (!token) return false;
  if (!env.RSVP_ADMIN_SESSION_SECRET) return null;
  return (await verifyAdminToken(token, env.RSVP_ADMIN_SESSION_SECRET, invitationId, Date.now())) !== null;
}

async function readLimitedJson(request: Request): Promise<LimitedJsonResult> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxGalleryPayloadBytes) {
    return { ok: false, reason: "payload_too_large" };
  }
  if (!request.body) return { ok: false, reason: "invalid_request" };
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxGalleryPayloadBytes) return { ok: false, reason: "payload_too_large" };
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { ok: false, reason: "invalid_request" };
  }
}

function writeResultResponse(result: GalleryWriteResult): Response {
  if (result.ok) return responseJson(result.result);
  return result.reason === "not_found"
    ? responseJson({ error: "not_found" }, 404)
    : responseJson({ error: "conflict" }, 409);
}

function galleryObjectKey(invitationId: string, assetId: string, width: GalleryWidth): string {
  return `invitations/${invitationId}/gallery/${assetId}-${width}.webp`;
}

function isWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 12
    && new TextDecoder("ascii").decode(bytes.subarray(0, 4)) === "RIFF"
    && new TextDecoder("ascii").decode(bytes.subarray(8, 12)) === "WEBP";
}

async function galleryAssetsExist(
  env: Env,
  invitationId: string,
  gallery: EditableInvitationGallery
): Promise<string[]> {
  const media = env.WEDDING_MEDIA;
  if (!media) return gallery.photos.map((photo) => photo.id);
  const missing: string[] = [];
  await Promise.all(gallery.photos.map(async (photo) => {
    if (!photo.assetId) {
      missing.push(photo.id);
      return;
    }
    const [small, large] = await Promise.all([
      media.get(galleryObjectKey(invitationId, photo.assetId, 640), "arrayBuffer"),
      media.get(galleryObjectKey(invitationId, photo.assetId, 1024), "arrayBuffer")
    ]);
    if (!small || !large) missing.push(photo.id);
  }));
  return missing;
}

export async function handlePublicInvitationGalleryRequest(
  request: Request,
  env: Env,
  invitationId: string
): Promise<Response> {
  if (request.method !== "GET") return responseJson({ error: "not_found" }, 404);
  try {
    const result = await getPublicInvitationGallery(env.DB, invitationId);
    return result
      ? responseJson(result, 200, "public, max-age=60, stale-while-revalidate=300")
      : responseJson({ error: "not_found" }, 404, "public, max-age=60");
  } catch {
    return responseJson({ error: "internal_error" }, 500);
  }
}

export async function handleAdminInvitationGalleryRequest(
  request: Request,
  env: Env,
  invitationId: string,
  action: AdminGalleryAction
): Promise<Response> {
  try {
    const authorized = await authenticated(request, env, invitationId);
    if (authorized === null) return responseJson({ error: "internal_error" }, 500);
    if (!authorized) return responseJson({ error: "unauthorized" }, 401);
    if (action === "gallery" && request.method === "GET") {
      const result = await getAdminInvitationGallery(env.DB, invitationId);
      return result ? responseJson(result) : responseJson({ error: "not_found" }, 404);
    }
    if (
      (action === "gallery" && request.method !== "PATCH")
      || (action !== "gallery" && request.method !== "POST")
    ) return responseJson({ error: "not_found" }, 404);

    const bodyResult = await readLimitedJson(request);
    if (!bodyResult.ok) {
      return responseJson(
        { error: bodyResult.reason },
        bodyResult.reason === "payload_too_large" ? 413 : 400
      );
    }
    const body = bodyResult.value;
    if (action === "gallery") {
      const revision = readRevision(body, true);
      const gallery = isRecord(body)
        ? parseEditableInvitationGallery(body.gallery, weddingContent.gallery)
        : null;
      if (revision === null || !gallery) return responseJson({ error: "invalid_request" }, 400);
      return writeResultResponse(await saveInvitationGalleryDraft(env.DB, {
        invitationId,
        gallery,
        expectedRevision: revision,
        historyId: `gallery_${crypto.randomUUID()}`,
        now: new Date().toISOString()
      }));
    }

    const revision = readRevision(body);
    if (revision === null) return responseJson({ error: "invalid_request" }, 400);
    if (action === "publish") {
      const current = await getAdminInvitationGallery(env.DB, invitationId);
      if (!current) return responseJson({ error: "not_found" }, 404);
      if (current.revision !== revision) return responseJson({ error: "conflict" }, 409);
      if (!current.draft) return responseJson({ error: "draft_missing" }, 409);
      const issues = editableInvitationGalleryPublishIssues(current.draft);
      if (issues.length > 0) return responseJson({ error: "gallery_incomplete", issues }, 409);
      const missingAssets = await galleryAssetsExist(env, invitationId, current.draft);
      if (missingAssets.length > 0) {
        return responseJson({ error: "gallery_assets_missing", slots: missingAssets.sort() }, 409);
      }
      return writeResultResponse(await publishInvitationGallery(env.DB, {
        invitationId,
        expectedRevision: revision,
        historyId: `gallery_${crypto.randomUUID()}`,
        now: new Date().toISOString()
      }));
    }

    const versionId = isRecord(body) && typeof body.versionId === "string" && /^gallery_[\w-]+$/.test(body.versionId)
      ? body.versionId
      : null;
    if (!versionId) return responseJson({ error: "invalid_request" }, 400);
    return writeResultResponse(await restoreInvitationGalleryVersion(env.DB, {
      invitationId,
      versionId,
      expectedRevision: revision,
      historyId: `gallery_${crypto.randomUUID()}`,
      now: new Date().toISOString()
    }));
  } catch {
    return responseJson({ error: "internal_error" }, 500);
  }
}

export async function handleAdminGalleryAssetRequest(
  request: Request,
  env: Env,
  invitationId: string,
  assetId: string,
  width: GalleryWidth
): Promise<Response> {
  try {
    const authorized = await authenticated(request, env, invitationId);
    if (authorized === null) return responseJson({ error: "internal_error" }, 500);
    if (!authorized) return responseJson({ error: "unauthorized" }, 401);
    const media = env.WEDDING_MEDIA;
    if (!media) return responseJson({ error: "internal_error" }, 500);
    if (!assetIdPattern.test(assetId)) return responseJson({ error: "not_found" }, 404);
    const key = galleryObjectKey(invitationId, assetId, width);

    if (request.method === "GET") {
      const bytes = await media.get(key, "arrayBuffer");
      if (!bytes) return responseJson({ error: "not_found" }, 404);
      return new Response(bytes, {
        headers: {
          "content-type": "image/webp",
          "cache-control": "private, no-store",
          "content-length": String(bytes.byteLength),
          etag: `"${assetId}-${width}"`
        }
      });
    }
    if (request.method !== "PUT") return responseJson({ error: "not_found" }, 404);
    const slotId = request.headers.get("x-gallery-slot-id") ?? "";
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (!slotIds.has(slotId)) return responseJson({ error: "invalid_request" }, 400);
    if (
      request.headers.get("content-type")?.split(";", 1)[0] !== "image/webp"
      || !Number.isInteger(contentLength)
      || contentLength < 12
      || contentLength > maxImageBytes[width]
    ) return responseJson({ error: "invalid_image" }, 400);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength !== contentLength || !isWebp(bytes)) {
      return responseJson({ error: "invalid_image" }, 400);
    }
    await media.put(key, bytes, {
      metadata: { invitationId, slotId, width: String(width), contentType: "image/webp" }
    });
    return responseJson({ assetId, width, size: bytes.byteLength }, 201);
  } catch {
    return responseJson({ error: "internal_error" }, 500);
  }
}

export async function handlePublishedGalleryMediaRequest(
  request: Request,
  env: Env,
  invitationId: string,
  assetId: string,
  width: GalleryWidth
): Promise<Response> {
  if ((request.method !== "GET" && request.method !== "HEAD") || !assetIdPattern.test(assetId)) {
    return new Response("Not Found", { status: 404 });
  }
  try {
    const media = env.WEDDING_MEDIA;
    if (!media) return new Response("Internal Server Error", { status: 500 });
    if (!(await isPublishedGalleryAsset(env.DB, invitationId, assetId))) {
      return new Response("Not Found", { status: 404 });
    }
    const key = galleryObjectKey(invitationId, assetId, width);
    const bytes = await media.get(key, "arrayBuffer");
    if (!bytes) return new Response("Not Found", { status: 404 });
    const responseBody = request.method === "GET" ? bytes : null;
    return new Response(responseBody, {
      headers: {
        "content-type": "image/webp",
        "content-length": String(bytes.byteLength),
        "cache-control": "public, max-age=31536000, immutable",
        etag: `"${assetId}-${width}"`,
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return new Response("Internal Server Error", { status: 500 });
  }
}
