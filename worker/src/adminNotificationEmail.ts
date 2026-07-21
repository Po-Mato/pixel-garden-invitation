import type { AdminNotification } from "@wedding-game/shared";
import type { Env } from "./index";

function configuredValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function adminNotificationEmailConfigured(env: Env): boolean {
  return Boolean(
    env.EMAIL
    && configuredValue(env.ADMIN_NOTIFICATION_EMAIL_TO)
    && configuredValue(env.ADMIN_NOTIFICATION_EMAIL_FROM)
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function adminUrl(env: Env, notification: AdminNotification): string {
  const base = configuredValue(env.ADMIN_NOTIFICATION_BASE_URL)
    ? env.ADMIN_NOTIFICATION_BASE_URL.replace(/\/$/, "")
    : "https://po-mato.github.io/pixel-garden-invitation";
  const page = notification.kind.startsWith("rsvp_") ? "rsvp" : "guestbook";
  return `${base}/?admin=${page}`;
}

export async function sendAdminNotificationEmail(
  env: Env,
  notification: AdminNotification
): Promise<boolean> {
  if (!adminNotificationEmailConfigured(env)) return false;

  const url = adminUrl(env, notification);
  await env.EMAIL!.send({
    to: env.ADMIN_NOTIFICATION_EMAIL_TO!,
    from: {
      email: env.ADMIN_NOTIFICATION_EMAIL_FROM!,
      name: "승재·건희 모바일 청첩장"
    },
    subject: `[모바일 청첩장] ${notification.title}`,
    text: `${notification.title}\n${notification.body}\n\n관리자 화면: ${url}`,
    html: `<h1 style="font-size:20px">${escapeHtml(notification.title)}</h1><p>${escapeHtml(notification.body)}</p><p><a href="${escapeHtml(url)}">관리자 화면에서 확인</a></p>`
  });
  return true;
}
