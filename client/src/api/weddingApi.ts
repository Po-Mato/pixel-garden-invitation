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

const apiBase = import.meta.env.VITE_WORKER_URL ?? "";
const invitationId = import.meta.env.VITE_INVITATION_ID ?? "sample-garden";

function buildApiUrl(base: string, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBase = base.replace(/\/+$/, "");
  return `${normalizedBase}${normalizedPath}`;
}

async function postJson(path: string, body: unknown): Promise<void> {
  const response = await fetch(buildApiUrl(apiBase, path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
}

export function submitRsvp(payload: RsvpPayload): Promise<void> {
  return postJson(`/api/invitations/${invitationId}/rsvps`, payload);
}

export function submitGuestbook(payload: GuestbookPayload): Promise<void> {
  return postJson(`/api/invitations/${invitationId}/guestbook`, payload);
}
