import type {
  PhotoFrameGalleryAdminResult,
  PhotoFrameGalleryDesign,
  PhotoFrameGalleryItem,
  PhotoFrameGalleryPublicResult,
  PhotoFrameGallerySubmissionInput,
  PhotoFrameGalleryStatus
} from "@wedding-game/shared";
import { WeddingApiError } from "./weddingApi";

function baseUrl() {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function invitationId() {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function path(admin = false, id?: string) {
  const root = `/api/invitations/${encodeURIComponent(invitationId())}/${admin ? "admin/" : ""}photo-frame-gallery`;
  return `${baseUrl()}${root}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "request_failed";
    throw new WeddingApiError(response.status, code, Number(response.headers.get("retry-after")) || undefined);
  }
  return body as T;
}

export function fetchPublicPhotoFrameGallery(signal?: AbortSignal) {
  return request<PhotoFrameGalleryPublicResult>(path(), { method: "GET", signal });
}

export function submitPhotoFrameGallery(input: PhotoFrameGallerySubmissionInput) {
  return request<PhotoFrameGalleryItem>(path(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function fetchAdminPhotoFrameGallery(token: string) {
  return request<PhotoFrameGalleryAdminResult>(path(true), {
    method: "GET",
    headers: { authorization: `Bearer ${token}` }
  });
}

export function moderateAdminPhotoFrameGallery(
  token: string,
  submissionId: string,
  status: Exclude<PhotoFrameGalleryStatus, "pending">
) {
  return request<PhotoFrameGalleryItem>(path(true, submissionId), {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ status })
  });
}

export type { PhotoFrameGalleryDesign };
