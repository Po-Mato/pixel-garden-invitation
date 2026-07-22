import type {
  GuestAnnouncementInput,
  GuestAnnouncementRecord,
  GuestFaqInput,
  GuestFaqRecord,
  GuestInformationAdminResult,
  GuestInformationPublicResult
} from "@wedding-game/shared";
import { WeddingApiError } from "./weddingApi";

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function apiBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function path(suffix = ""): string {
  return `${apiBase()}/api/invitations/${encodeURIComponent(invitationId())}/guest-information${suffix}`;
}

function adminPath(suffix = ""): string {
  return `${apiBase()}/api/invitations/${encodeURIComponent(invitationId())}/admin/guest-information${suffix}`;
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function error(response: Response, value: unknown): WeddingApiError {
  const code = typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : "request_failed";
  return new WeddingApiError(response.status, code);
}

async function jsonRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const value = await responseBody(response);
  if (!response.ok) throw error(response, value);
  return value as T;
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

export function fetchGuestInformation(signal?: AbortSignal): Promise<GuestInformationPublicResult> {
  return jsonRequest(path(), { method: "GET", signal });
}

export async function recordGuestInformationViews(announcementIds: string[]): Promise<void> {
  const response = await fetch(path("/views"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ announcementIds })
  });
  if (!response.ok) throw error(response, await responseBody(response));
}

export function fetchAdminGuestInformation(token: string): Promise<GuestInformationAdminResult> {
  return jsonRequest(adminPath(), authorized(token));
}

export function createAdminGuestAnnouncement(
  token: string,
  input: GuestAnnouncementInput
): Promise<GuestAnnouncementRecord> {
  return jsonRequest(adminPath(), authorized(token, "POST", { kind: "announcement", input }));
}

export function createAdminGuestFaq(token: string, input: GuestFaqInput): Promise<GuestFaqRecord> {
  return jsonRequest(adminPath(), authorized(token, "POST", { kind: "faq", input }));
}

export function updateAdminGuestAnnouncement(
  token: string,
  itemId: string,
  input: GuestAnnouncementInput
): Promise<GuestAnnouncementRecord> {
  return jsonRequest(adminPath(`/announcements/${encodeURIComponent(itemId)}`), authorized(token, "PATCH", input));
}

export function updateAdminGuestFaq(
  token: string,
  itemId: string,
  input: GuestFaqInput
): Promise<GuestFaqRecord> {
  return jsonRequest(adminPath(`/faqs/${encodeURIComponent(itemId)}`), authorized(token, "PATCH", input));
}

export async function deleteAdminGuestInformationItem(
  token: string,
  kind: "announcements" | "faqs",
  itemId: string
): Promise<void> {
  const response = await fetch(
    adminPath(`/${kind}/${encodeURIComponent(itemId)}`),
    authorized(token, "DELETE")
  );
  if (!response.ok) throw error(response, await responseBody(response));
}
