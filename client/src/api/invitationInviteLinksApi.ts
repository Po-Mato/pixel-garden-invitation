import type {
  InvitationInviteLinkAdminResult,
  InvitationInviteLinkCreateResult,
  InvitationInviteLinkCreated,
  InvitationInviteLinkInput,
  InvitationInviteLinkRecord,
  InvitationInviteLinkUpdate,
  PublicInvitationInvite
} from "@wedding-game/shared";
import { loadStoredInvitationInvite } from "../invitation/inviteLinkStorage";
import { createRsvp, WeddingApiError } from "./weddingApi";

function apiBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function apiUrl(path: string): string {
  return `${apiBase()}${path.startsWith("/") ? path : `/${path}`}`;
}

function adminPath(suffix = ""): string {
  return `/api/invitations/${encodeURIComponent(invitationId())}/admin/invite-links${suffix}`;
}

async function responseBody(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}

function responseError(response: Response, body: unknown): WeddingApiError {
  const code = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
    ? body.error
    : "request_failed";
  return new WeddingApiError(response.status, code);
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  const body = await responseBody(response);
  if (!response.ok) throw responseError(response, body);
  if (body === null) throw new WeddingApiError(response.status, "invalid_response");
  return body as T;
}

function authorized(token: string, method = "GET", body?: unknown): RequestInit {
  return {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  };
}

export function fetchPublicInvitationInvite(token: string, signal?: AbortSignal): Promise<PublicInvitationInvite> {
  return requestJson<PublicInvitationInvite>(
    `/api/invitations/${encodeURIComponent(invitationId())}/invites/${encodeURIComponent(token)}`,
    { method: "GET", signal }
  );
}

export function fetchAdminInvitationInviteLinks(token: string): Promise<InvitationInviteLinkAdminResult> {
  return requestJson<InvitationInviteLinkAdminResult>(adminPath(), authorized(token));
}

export function createAdminInvitationInviteLinks(
  token: string,
  links: InvitationInviteLinkInput[]
): Promise<InvitationInviteLinkCreateResult> {
  return requestJson<InvitationInviteLinkCreateResult>(adminPath(), authorized(token, "POST", { links }));
}

export function updateAdminInvitationInviteLink(
  token: string,
  linkId: string,
  update: InvitationInviteLinkUpdate
): Promise<InvitationInviteLinkRecord> {
  return requestJson<InvitationInviteLinkRecord>(
    adminPath(`/${encodeURIComponent(linkId)}`),
    authorized(token, "PATCH", update)
  );
}

export function rotateAdminInvitationInviteLink(
  token: string,
  linkId: string
): Promise<InvitationInviteLinkCreateResult> {
  return requestJson<InvitationInviteLinkCreateResult>(
    adminPath(`/${encodeURIComponent(linkId)}/rotate`),
    authorized(token, "POST")
  );
}

export async function deleteAdminInvitationInviteLink(token: string, linkId: string): Promise<void> {
  const response = await fetch(apiUrl(adminPath(`/${encodeURIComponent(linkId)}`)), authorized(token, "DELETE"));
  if (response.ok) return;
  throw responseError(response, await responseBody(response));
}

export function createRsvpWithInviteLink(
  payload: Parameters<typeof createRsvp>[0],
  botProtection?: unknown
): ReturnType<typeof createRsvp> {
  const invokeCreateRsvp = createRsvp as (...args: unknown[]) => ReturnType<typeof createRsvp>;
  const stored = loadStoredInvitationInvite(invitationId());
  if (!stored) {
    return botProtection === undefined
      ? invokeCreateRsvp(payload)
      : invokeCreateRsvp(payload, botProtection);
  }

  const body = botProtection === undefined
    ? payload
    : { ...(payload as object), botProtection };
  return requestJson<Awaited<ReturnType<typeof createRsvp>>>(`/api/invitations/${encodeURIComponent(invitationId())}/rsvps`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-invite-token": stored.token },
    body: JSON.stringify(body)
  }) as ReturnType<typeof createRsvp>;
}

export type { InvitationInviteLinkCreated };
