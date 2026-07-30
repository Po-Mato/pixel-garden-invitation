import { WeddingApiError } from "./weddingApi";

export type GameTransferStatus = "active" | "claimed" | "revoked" | "expired";
export type GameTransferState = {
  id: string;
  status: GameTransferStatus;
  entryCount: number;
  createdAt: string;
  expiresAt: string;
  claimedAt: string | null;
  revokedAt: string | null;
};

export type CreatedGameTransfer = GameTransferState & { claimToken: string; manageToken: string };

function baseUrl() {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function invitationId() {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function path(id?: string, action?: "claim") {
  const root = `${baseUrl()}/api/invitations/${encodeURIComponent(invitationId())}/game-transfers`;
  return id ? `${root}/${encodeURIComponent(id)}${action ? `/${action}` : ""}` : root;
}

async function request<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "request_failed";
    throw new WeddingApiError(response.status, code);
  }
  return body as T;
}

export function createServerGameTransfer(entryCount: number, expiresAt: string) {
  return request<CreatedGameTransfer>(path(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entryCount, expiresAt })
  });
}

export function fetchServerGameTransfer(id: string, token: string) {
  return request<GameTransferState>(path(id), { method: "GET", headers: { authorization: `Bearer ${token}` } });
}

export function claimServerGameTransfer(id: string, claimToken: string) {
  return request<GameTransferState>(path(id, "claim"), { method: "POST", headers: { authorization: `Bearer ${claimToken}` } });
}

export function revokeServerGameTransfer(id: string, manageToken: string) {
  return request<GameTransferState>(path(id), { method: "DELETE", headers: { authorization: `Bearer ${manageToken}` } });
}
