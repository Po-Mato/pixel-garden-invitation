/// <reference types="vite/client" />

import type {
  GuestbookAdminResult,
  GuestbookCreateResult,
  GuestbookCredential,
  GuestbookOwnedMessage,
  GuestbookPage,
  GuestbookSubmission,
  RsvpAdminResult,
  RsvpCreateResult,
  RsvpRecord,
  RsvpSubmission
} from "@wedding-game/shared";

export type GuestbookPayload = GuestbookSubmission;
export type { GuestbookCredential, GuestbookOwnedMessage, GuestbookPage };

export type RsvpCredential = {
  rsvpId: string;
  editToken: string;
};

export type RsvpUpdatePayload = RsvpSubmission & {
  revision: number;
};

export type AdminSession = {
  token: string;
  expiresAt: number;
};

export class WeddingApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, code: string, retryAfterSeconds?: number) {
    super(code);
    this.name = "WeddingApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function buildApiUrl(base: string, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBase = base.replace(/\/+$/, "");
  return `${normalizedBase}${normalizedPath}`;
}

function getApiBase() {
  return import.meta.env.VITE_WORKER_URL ?? "";
}

function getInvitationId() {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return undefined;
  const seconds = Number(trimmed);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorCode(body: unknown): string {
  return isRecord(body) && typeof body.error === "string" && body.error.length > 0
    ? body.error
    : "request_failed";
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(getApiBase(), path), init);
  const body = await parseResponseBody(response);
  if (!response.ok) {
    throw new WeddingApiError(response.status, errorCode(body), parseRetryAfterSeconds(response.headers.get("retry-after")));
  }
  if (body === null) throw new WeddingApiError(response.status, "invalid_response");
  return body as T;
}

function rsvpPath(): string {
  return `/api/invitations/${getInvitationId()}/rsvps`;
}

function guestbookPath(): string {
  return `/api/invitations/${getInvitationId()}/guestbook`;
}

function bearerHeaders(token: string): HeadersInit {
  return { authorization: `Bearer ${token}` };
}

export function createRsvp(payload: RsvpSubmission): Promise<RsvpCreateResult> {
  return requestJson<RsvpCreateResult>(rsvpPath(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function fetchOwnedRsvp(credential: RsvpCredential): Promise<RsvpRecord> {
  return requestJson<RsvpRecord>(`${rsvpPath()}/${encodeURIComponent(credential.rsvpId)}`, {
    method: "GET",
    headers: bearerHeaders(credential.editToken)
  });
}

export function updateOwnedRsvp(credential: RsvpCredential, payload: RsvpUpdatePayload): Promise<RsvpRecord> {
  return requestJson<RsvpRecord>(`${rsvpPath()}/${encodeURIComponent(credential.rsvpId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...bearerHeaders(credential.editToken) },
    body: JSON.stringify(payload)
  });
}

export function createAdminSession(password: string): Promise<AdminSession> {
  return requestJson<AdminSession>(`/api/invitations/${getInvitationId()}/admin/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password })
  });
}

export function fetchAdminRsvps(token: string): Promise<RsvpAdminResult> {
  return requestJson<RsvpAdminResult>(`/api/invitations/${getInvitationId()}/admin/rsvps`, {
    method: "GET",
    headers: bearerHeaders(token)
  });
}

export async function deleteAdminRsvp(token: string, rsvpId: string): Promise<void> {
  const response = await fetch(buildApiUrl(
    getApiBase(),
    `/api/invitations/${getInvitationId()}/admin/rsvps/${encodeURIComponent(rsvpId)}`
  ), {
    method: "DELETE",
    headers: bearerHeaders(token)
  });
  if (response.ok) return;

  const body = await parseResponseBody(response);
  throw new WeddingApiError(response.status, errorCode(body), parseRetryAfterSeconds(response.headers.get("retry-after")));
}

export function createGuestbook(payload: GuestbookSubmission): Promise<GuestbookCreateResult> {
  return requestJson<GuestbookCreateResult>(guestbookPath(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function fetchGuestbookPage(cursor?: string): Promise<GuestbookPage> {
  const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return requestJson<GuestbookPage>(`${guestbookPath()}${suffix}`, { method: "GET" });
}

export function fetchOwnedGuestbook(credential: GuestbookCredential): Promise<GuestbookOwnedMessage> {
  return requestJson<GuestbookOwnedMessage>(
    `${guestbookPath()}/${encodeURIComponent(credential.guestbookId)}`,
    { method: "GET", headers: bearerHeaders(credential.editToken) }
  );
}

export function updateOwnedGuestbook(
  credential: GuestbookCredential,
  payload: GuestbookSubmission & { revision: number }
): Promise<GuestbookOwnedMessage> {
  return requestJson<GuestbookOwnedMessage>(
    `${guestbookPath()}/${encodeURIComponent(credential.guestbookId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json", ...bearerHeaders(credential.editToken) },
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteOwnedGuestbook(credential: GuestbookCredential): Promise<void> {
  const response = await fetch(buildApiUrl(
    getApiBase(),
    `${guestbookPath()}/${encodeURIComponent(credential.guestbookId)}`
  ), {
    method: "DELETE",
    headers: bearerHeaders(credential.editToken)
  });
  if (response.ok) return;
  const body = await parseResponseBody(response);
  throw new WeddingApiError(response.status, errorCode(body), parseRetryAfterSeconds(response.headers.get("retry-after")));
}

export function fetchAdminGuestbook(token: string): Promise<GuestbookAdminResult> {
  return requestJson<GuestbookAdminResult>(`/api/invitations/${getInvitationId()}/admin/guestbook`, {
    method: "GET",
    headers: bearerHeaders(token)
  });
}

export function moderateAdminGuestbook(
  token: string,
  guestbookId: string,
  hidden: boolean,
  revision: number
): Promise<GuestbookOwnedMessage> {
  return requestJson<GuestbookOwnedMessage>(
    `/api/invitations/${getInvitationId()}/admin/guestbook/${encodeURIComponent(guestbookId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json", ...bearerHeaders(token) },
      body: JSON.stringify({ hidden, revision })
    }
  );
}

export async function deleteAdminGuestbook(token: string, guestbookId: string): Promise<void> {
  const response = await fetch(buildApiUrl(
    getApiBase(),
    `/api/invitations/${getInvitationId()}/admin/guestbook/${encodeURIComponent(guestbookId)}`
  ), {
    method: "DELETE",
    headers: bearerHeaders(token)
  });
  if (response.ok) return;
  const body = await parseResponseBody(response);
  throw new WeddingApiError(response.status, errorCode(body), parseRetryAfterSeconds(response.headers.get("retry-after")));
}
