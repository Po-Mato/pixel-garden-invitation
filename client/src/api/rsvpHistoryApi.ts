import type { RsvpHistoryResult } from "@wedding-game/shared";
import { WeddingApiError } from "./weddingApi";
import type { RsvpCredential } from "./weddingApi";

function apiBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

export async function fetchAdminRsvpHistory(token: string, rsvpId: string): Promise<RsvpHistoryResult> {
  const response = await fetch(
    `${apiBase()}/api/invitations/${invitationId()}/admin/rsvps/${encodeURIComponent(rsvpId)}/history`,
    { method: "GET", headers: { authorization: `Bearer ${token}` } }
  );
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "request_failed";
    throw new WeddingApiError(response.status, code);
  }
  if (!body) throw new WeddingApiError(response.status, "invalid_response");
  return body as RsvpHistoryResult;
}

export async function restoreAdminRsvpHistory(
  token: string,
  rsvpId: string,
  input: { targetRevision: number; currentRevision: number; reason: string }
): Promise<RsvpHistoryResult> {
  const response = await fetch(
    `${apiBase()}/api/invitations/${invitationId()}/admin/rsvps/${encodeURIComponent(rsvpId)}/history`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    }
  );
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "request_failed";
    throw new WeddingApiError(response.status, code);
  }
  if (!body) throw new WeddingApiError(response.status, "invalid_response");
  return body as RsvpHistoryResult;
}

export async function fetchOwnedRsvpHistory(credential: RsvpCredential): Promise<RsvpHistoryResult> {
  const response = await fetch(
    `${apiBase()}/api/invitations/${invitationId()}/rsvps/${encodeURIComponent(credential.rsvpId)}/history`,
    { method: "GET", headers: { authorization: `Bearer ${credential.editToken}` } }
  );
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "request_failed";
    throw new WeddingApiError(response.status, code);
  }
  if (!body) throw new WeddingApiError(response.status, "invalid_response");
  return body as RsvpHistoryResult;
}
