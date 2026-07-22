import type {
  InvitationReleaseAdminResult,
  InvitationReleasePublicResult
} from "@wedding-game/shared";
import { WeddingApiError } from "./weddingApi";

function apiBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function adminPath(suffix = ""): string {
  const invitationId = import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
  return `/api/invitations/${encodeURIComponent(invitationId)}/admin/releases${suffix}`;
}

function publicPath(): string {
  const invitationId = import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
  return `/api/invitations/${encodeURIComponent(invitationId)}/release`;
}

export async function fetchPublishedInvitationRelease(signal?: AbortSignal): Promise<InvitationReleasePublicResult> {
  const response = await fetch(`${apiBase()}${publicPath()}`, { method: "GET", signal });
  let result: unknown = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  if (!response.ok || !result) throw new WeddingApiError(response.status, "request_failed");
  return result as InvitationReleasePublicResult;
}

async function request(token: string, suffix = "", body?: unknown): Promise<InvitationReleaseAdminResult> {
  const response = await fetch(`${apiBase()}${adminPath(suffix)}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  let result: unknown = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  if (!response.ok) {
    const code = typeof result === "object" && result !== null && "error" in result
      && typeof result.error === "string"
      ? result.error
      : "request_failed";
    throw new WeddingApiError(response.status, code);
  }
  if (!result) throw new WeddingApiError(response.status, "invalid_response");
  return result as InvitationReleaseAdminResult;
}

export function fetchAdminInvitationRelease(token: string) {
  return request(token);
}

export function publishAdminInvitationRelease(
  token: string,
  contentRevision: number,
  galleryRevision: number
) {
  return request(token, "/publish", { contentRevision, galleryRevision });
}

export function scheduleAdminInvitationRelease(
  token: string,
  contentRevision: number,
  galleryRevision: number,
  scheduledFor: string
) {
  return request(token, "/schedule", { contentRevision, galleryRevision, scheduledFor });
}

export function cancelAdminInvitationReleaseSchedule(token: string) {
  return request(token, "/cancel", {});
}

export function restoreAdminInvitationRelease(token: string, releaseId: string) {
  return request(token, "/restore", { releaseId });
}
