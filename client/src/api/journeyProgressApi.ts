import { loadStoredInvitationInvite } from "../invitation/inviteLinkStorage";
import type { JourneyProgress } from "../game/journeyProgress";

function apiBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function tokenFingerprint(token: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function requestContext(): { url: string; token: string; scope: string } | null {
  const id = invitationId();
  const stored = loadStoredInvitationInvite(id);
  return stored ? {
    url: `${apiBase()}/api/invitations/${encodeURIComponent(id)}/journey-progress`,
    token: stored.token,
    scope: `${id}:${tokenFingerprint(stored.token)}`
  } : null;
}

export function canSyncJourneyProgress(): boolean {
  return requestContext() !== null;
}

export function journeyProgressSyncScope(): string | null {
  return requestContext()?.scope ?? null;
}

async function parseProgress(response: Response): Promise<JourneyProgress> {
  if (!response.ok) throw new Error("journey_sync_unavailable");
  return response.json() as Promise<JourneyProgress>;
}

export async function fetchSyncedJourneyProgress(): Promise<JourneyProgress | null> {
  const context = requestContext();
  if (!context) return null;
  return parseProgress(await fetch(context.url, {
    method: "GET",
    headers: { "x-invite-token": context.token, accept: "application/json" }
  }));
}

export async function saveSyncedJourneyProgress(progress: JourneyProgress): Promise<JourneyProgress | null> {
  const context = requestContext();
  if (!context) return null;
  return parseProgress(await fetch(context.url, {
    method: "PUT",
    headers: { "x-invite-token": context.token, "content-type": "application/json" },
    body: JSON.stringify(progress)
  }));
}
