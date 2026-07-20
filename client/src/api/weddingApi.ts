/// <reference types="vite/client" />

import type { RsvpAdminResult, RsvpCreateResult, RsvpRecord, RsvpSubmission } from "@wedding-game/shared";

export type GuestbookPayload = {
  nickname: string;
  message: string;
};

export type GuestbookMessage = {
  id: string;
  nickname: string;
  message: string;
  createdAt: string;
};

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

function isGuestbookMessage(value: unknown): value is GuestbookMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.nickname === "string" &&
    typeof value.message === "string" &&
    typeof value.createdAt === "string"
  );
}

async function postJson(path: string, body: unknown): Promise<void> {
  const response = await fetch(buildApiUrl(getApiBase(), path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
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

export function submitGuestbook(payload: GuestbookPayload): Promise<void> {
  return postJson(`/api/invitations/${getInvitationId()}/guestbook`, payload);
}

export async function fetchGuestbookMessages(): Promise<GuestbookMessage[]> {
  const response = await fetch(buildApiUrl(getApiBase(), `/api/invitations/${getInvitationId()}/guestbook`), {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.messages)) {
    return [];
  }

  return body.messages.filter(isGuestbookMessage);
}
