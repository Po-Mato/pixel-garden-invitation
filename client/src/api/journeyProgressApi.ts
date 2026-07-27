import { loadStoredInvitationInvite } from "../invitation/inviteLinkStorage";
import type { JourneyProgress } from "../game/journeyProgress";

function apiBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function requestContext(): { url: string; token: string } | null {
  const id = invitationId();
  const stored = loadStoredInvitationInvite(id);
  return stored ? {
    url: `${apiBase()}/api/invitations/${encodeURIComponent(id)}/journey-progress`,
    token: stored.token
  } : null;
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
