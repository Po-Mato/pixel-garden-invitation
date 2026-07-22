import type { InvitationReminderAdminResult, InvitationReminderDeliveryInput } from "@wedding-game/shared";
import { WeddingApiError } from "./weddingApi";

function apiBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function path(): string {
  return `${apiBase()}/api/invitations/${encodeURIComponent(invitationId())}/admin/reminders`;
}

async function body(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}

async function request(token: string, method: "GET" | "POST", value?: unknown): Promise<InvitationReminderAdminResult> {
  const response = await fetch(path(), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(value === undefined ? {} : { "content-type": "application/json" })
    },
    ...(value === undefined ? {} : { body: JSON.stringify(value) })
  });
  const result = await body(response);
  if (!response.ok) {
    const code = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
      ? result.error
      : "request_failed";
    throw new WeddingApiError(response.status, code);
  }
  return result as InvitationReminderAdminResult;
}

export function fetchAdminInvitationReminders(token: string): Promise<InvitationReminderAdminResult> {
  return request(token, "GET");
}

export function recordAdminInvitationReminders(
  token: string,
  input: InvitationReminderDeliveryInput
): Promise<InvitationReminderAdminResult> {
  return request(token, "POST", input);
}
