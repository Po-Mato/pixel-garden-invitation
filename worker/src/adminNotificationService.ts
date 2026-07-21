import type { AdminNotificationKind } from "@wedding-game/shared";
import {
  createAdminNotification,
  recordAdminNotificationEmailResult
} from "./adminNotificationRepository";
import { sendAdminNotificationEmail } from "./adminNotificationEmail";
import type { Env } from "./index";

export type AdminNotificationEvent = {
  invitationId: string;
  kind: AdminNotificationKind;
  sourceId: string;
  title: string;
  body: string;
  expiresAt: string;
};

type WaitUntil = (task: Promise<unknown>) => void;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 240) : "unknown_email_error";
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
    const send = sendAdminNotificationEmail(env, notification)
      .then(async (sent) => {
        if (sent) {
          await recordAdminNotificationEmailResult(env.DB, notification.id, new Date().toISOString(), null);
        }
      })
      .catch(async (error: unknown) => {
        console.error(JSON.stringify({ event: "admin_notification_email_failed", notificationId: notification.id }));
        await recordAdminNotificationEmailResult(env.DB, notification.id, null, errorMessage(error));
      });

    if (waitUntil) waitUntil(send);
    else await send;
  } catch {
    console.error(JSON.stringify({ event: "admin_notification_record_failed", kind: event.kind }));
  }
}
