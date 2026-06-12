/// <reference types="vite/client" />

export type RsvpPayload = {
  guestName: string;
  attendance: "yes" | "no" | "unsure";
  partySize: number;
  note: string;
};

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

export function submitRsvp(payload: RsvpPayload): Promise<void> {
  return postJson(`/api/invitations/${getInvitationId()}/rsvps`, payload);
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
