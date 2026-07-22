import type {
  EditableInvitationGallery,
  InvitationGalleryAdminResult,
  InvitationGalleryPublicResult
} from "@wedding-game/shared";
import { WeddingApiError } from "./weddingApi";

function apiBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function path(suffix = ""): string {
  return `/api/invitations/${encodeURIComponent(invitationId())}/gallery${suffix}`;
}

function adminPath(suffix = ""): string {
  return `/api/invitations/${encodeURIComponent(invitationId())}/admin/gallery${suffix}`;
}

async function requestJson<T>(requestPath: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${requestPath}`, init);
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const code = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : "request_failed";
    throw new WeddingApiError(response.status, code);
  }
  if (body === null) throw new WeddingApiError(response.status, "invalid_response");
  return body as T;
}

function authorizedJson(token: string, body?: unknown): RequestInit {
  return {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  };
}

export function fetchPublishedInvitationGallery(signal?: AbortSignal): Promise<InvitationGalleryPublicResult> {
  return requestJson<InvitationGalleryPublicResult>(path(), { method: "GET", signal });
}

export function fetchAdminInvitationGallery(token: string): Promise<InvitationGalleryAdminResult> {
  return requestJson<InvitationGalleryAdminResult>(adminPath(), authorizedJson(token));
}

export function saveAdminInvitationGallery(
  token: string,
  gallery: EditableInvitationGallery,
  revision: number
): Promise<InvitationGalleryAdminResult> {
  return requestJson<InvitationGalleryAdminResult>(adminPath(), {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ gallery, revision })
  });
}

export function publishAdminInvitationGallery(
  token: string,
  revision: number
): Promise<InvitationGalleryAdminResult> {
  return requestJson<InvitationGalleryAdminResult>(adminPath("/publish"), authorizedJson(token, { revision }));
}

export function restoreAdminInvitationGallery(
  token: string,
  versionId: string,
  revision: number
): Promise<InvitationGalleryAdminResult> {
  return requestJson<InvitationGalleryAdminResult>(
    adminPath("/restore"),
    authorizedJson(token, { versionId, revision })
  );
}

export async function uploadAdminGalleryAsset(
  token: string,
  slotId: string,
  assetId: string,
  width: 640 | 1024,
  blob: Blob
): Promise<void> {
  await requestJson(
    adminPath(`/assets/${encodeURIComponent(assetId)}/${width}`),
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "image/webp",
        "x-gallery-slot-id": slotId
      },
      body: blob
    }
  );
}

export async function fetchAdminGalleryAsset(
  token: string,
  assetId: string,
  width: 640 | 1024,
  signal?: AbortSignal
): Promise<Blob> {
  const response = await fetch(`${apiBase()}${adminPath(`/assets/${encodeURIComponent(assetId)}/${width}`)}`, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    signal
  });
  if (!response.ok) throw new WeddingApiError(response.status, "asset_request_failed");
  return response.blob();
}

export function invitationGalleryMediaUrl(assetId: string, width: 640 | 1024): string {
  return `${apiBase()}/media/invitations/${encodeURIComponent(invitationId())}/gallery/${encodeURIComponent(assetId)}-${width}.webp`;
}
