import type { AdminNotificationKind } from "@wedding-game/shared";
import {
  claimAdminNotificationEmail,
  createAdminNotification,
  listPendingAdminNotificationEmailIds,
  MAX_ADMIN_NOTIFICATION_EMAIL_ATTEMPTS,
  recordAdminNotificationEmailFailure,
  recordAdminNotificationEmailSuccess
} from "./adminNotificationRepository";
import { adminNotificationEmailConfigured, sendAdminNotificationEmail } from "./adminNotificationEmail";
import type { Env } from "./index";

export type AdminNotificationEvent = {
  invitationId: string;
  eventKey: string;
  kind: AdminNotificationKind;
  sourceId: string;
  title: string;
  body: string;
  expiresAt: string;
};

type WaitUntil = (task: Promise<unknown>) => void;

function errorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "UNKNOWN";
  const message = error instanceof Error ? error.message : "unknown_email_error";
  return `${code}: ${message}`.slice(0, 240);
}

function errorCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : null;
}

const permanentErrorCodes = new Set([
  "E_VALIDATION_ERROR",
  "E_FIELD_MISSING",
  "E_TOO_MANY_RECIPIENTS",
  "E_SENDER_NOT_VERIFIED",
  "E_RECIPIENT_NOT_ALLOWED",
  "E_RECIPIENT_SUPPRESSED",
  "E_SENDER_DOMAIN_NOT_AVAILABLE",
  "E_CONTENT_TOO_LARGE",
  "E_HEADER_NOT_ALLOWED",
  "E_HEADER_USE_API_FIELD",
  "E_HEADER_VALUE_INVALID",
  "E_HEADER_VALUE_TOO_LONG",
  "E_HEADER_NAME_INVALID",
  "E_HEADERS_TOO_LARGE",
  "E_HEADERS_TOO_MANY"
]);

const retryDelayMs = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 8 * 60 * 60_000];

function nextAttemptAt(error: unknown, attempts: number, now: Date): string | null {
  if (attempts >= MAX_ADMIN_NOTIFICATION_EMAIL_ATTEMPTS) return null;
  const delay = errorCode(error) === "E_DAILY_LIMIT_EXCEEDED"
    ? 24 * 60 * 60_000
    : retryDelayMs[Math.min(attempts - 1, retryDelayMs.length - 1)];
  return new Date(now.getTime() + delay).toISOString();
}

async function deliverAdminNotificationEmail(
  env: Env,
  notificationId: string,
  now = new Date()
): Promise<"sent" | "failed" | "skipped"> {
  if (!adminNotificationEmailConfigured(env)) return "skipped";

  const attemptedAt = now.toISOString();
  const notification = await claimAdminNotificationEmail(
    env.DB,
    notificationId,
    attemptedAt,
    new Date(now.getTime() + 10 * 60_000).toISOString()
  );
  if (!notification) return "skipped";

  try {
    await sendAdminNotificationEmail(env, notification);
    await recordAdminNotificationEmailSuccess(env.DB, notification.id, new Date().toISOString());
    return "sent";
  } catch (error) {
    const terminal = permanentErrorCodes.has(errorCode(error) ?? "")
      || notification.emailAttempts >= MAX_ADMIN_NOTIFICATION_EMAIL_ATTEMPTS;
    await recordAdminNotificationEmailFailure(
      env.DB,
      notification.id,
      errorMessage(error),
      terminal ? null : nextAttemptAt(error, notification.emailAttempts, now),
      terminal
    );
    console.error(JSON.stringify({
      event: "admin_notification_email_failed",
      notificationId: notification.id,
      code: errorCode(error),
      terminal
    }));
    return "failed";
  }
}

export type AdminNotificationEmailQueueResult = {
  attempted: number;
  sent: number;
  failed: number;
};

export async function retryPendingAdminNotificationEmails(
  env: Env,
  now = new Date()
): Promise<AdminNotificationEmailQueueResult> {
  const result = { attempted: 0, sent: 0, failed: 0 };
  if (!adminNotificationEmailConfigured(env)) return result;

  const notificationIds = await listPendingAdminNotificationEmailIds(env.DB, now.toISOString());
  for (const notificationId of notificationIds) {
    const delivery = await deliverAdminNotificationEmail(env, notificationId, now);
    if (delivery === "skipped") continue;
    result.attempted += 1;
    if (delivery === "sent") result.sent += 1;
    else result.failed += 1;
  }
  return result;
}

export async function publishAdminNotification(
  env: Env,
  event: AdminNotificationEvent,
  waitUntil?: WaitUntil
): Promise<void> {
  try {
    const createdAt = new Date().toISOString();
    const notification = await createAdminNotification(env.DB, {
      id: `notification_${crypto.randomUUID()}`,
      ...event,
      createdAt
    });
    if (!notification || !adminNotificationEmailConfigured(env)) return;
    const send = deliverAdminNotificationEmail(env, notification.id);

    if (waitUntil) waitUntil(send);
    else await send;
  } catch {
    console.error(JSON.stringify({ event: "admin_notification_record_failed", kind: event.kind }));
  }
}
