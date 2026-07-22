import type {
  InvitationAnalyticsAdminResult,
  InvitationAnalyticsEventBatch
} from "@wedding-game/shared";
import { WeddingApiError } from "./weddingApi";

function apiBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

export function invitationAnalyticsEventsUrl(): string {
  return `${apiBase()}/api/invitations/${encodeURIComponent(invitationId())}/analytics/events`;
}

function adminAnalyticsUrl(range: { from?: string; to?: string }): string {
  const url = new URL(
    `${apiBase()}/api/invitations/${encodeURIComponent(invitationId())}/admin/analytics`,
    window.location.origin
  );
  if (range.from) url.searchParams.set("from", range.from);
  if (range.to) url.searchParams.set("to", range.to);
  return url.toString();
}

export async function postInvitationAnalyticsEvents(batch: InvitationAnalyticsEventBatch): Promise<void> {
  const response = await fetch(invitationAnalyticsEventsUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(batch),
    keepalive: true
  });
  if (!response.ok) throw new WeddingApiError(response.status, "analytics_failed");
}

export async function fetchAdminInvitationAnalytics(
  token: string,
  range: { from?: string; to?: string } = {}
): Promise<InvitationAnalyticsAdminResult> {
  const response = await fetch(adminAnalyticsUrl(range), {
    method: "GET",
    headers: { authorization: `Bearer ${token}` }
  });
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
  if (!body) throw new WeddingApiError(response.status, "invalid_response");
  return body as InvitationAnalyticsAdminResult;
}
