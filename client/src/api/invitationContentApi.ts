import type {
  EditableInvitationContent,
  InvitationContentAdminResult,
  InvitationContentPublicResult
} from "@wedding-game/shared";
import { WeddingApiError } from "./weddingApi";

function apiBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function apiUrl(path: string): string {
  return `${apiBase()}${path.startsWith("/") ? path : `/${path}`}`;
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
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

function publicContentPath(): string {
  return `/api/invitations/${encodeURIComponent(invitationId())}/content`;
}

function adminContentPath(suffix = ""): string {
  return `/api/invitations/${encodeURIComponent(invitationId())}/admin/content${suffix}`;
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

export function fetchPublishedInvitationContent(signal?: AbortSignal): Promise<InvitationContentPublicResult> {
  return requestJson<InvitationContentPublicResult>(publicContentPath(), { method: "GET", signal });
}

export function fetchAdminInvitationContent(token: string): Promise<InvitationContentAdminResult> {
  return requestJson<InvitationContentAdminResult>(adminContentPath(), authorizedJson(token));
}

export function saveAdminInvitationContent(
  token: string,
  content: EditableInvitationContent,
  revision: number
): Promise<InvitationContentAdminResult> {
  return requestJson<InvitationContentAdminResult>(adminContentPath(), {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ content, revision })
  });
}

export function publishAdminInvitationContent(
  token: string,
  revision: number
): Promise<InvitationContentAdminResult> {
  return requestJson<InvitationContentAdminResult>(
    adminContentPath("/publish"),
    authorizedJson(token, { revision })
  );
}

export function restoreAdminInvitationContent(
  token: string,
  versionId: string,
  revision: number
): Promise<InvitationContentAdminResult> {
  return requestJson<InvitationContentAdminResult>(
    adminContentPath("/restore"),
    authorizedJson(token, { versionId, revision })
  );
}
