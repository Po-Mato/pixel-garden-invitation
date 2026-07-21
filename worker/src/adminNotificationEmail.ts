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
      name: "건희·승재 모바일 청첩장"
    },
    subject: `[모바일 청첩장] ${notification.title}`,
    text: `${notification.title}\n${notification.body}\n\n관리자 화면에서 확인: ${url}`,
    html: `<!doctype html><html lang="ko"><body style="margin:0;background:#f2f4f0;color:#263129;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(notification.title)}이 도착했습니다.</div><div style="max-width:560px;margin:0 auto;padding:32px 18px"><div style="background:#ffffff;border:1px solid #d8ded8;padding:28px"><p style="margin:0 0 8px;color:#657168;font-size:12px;font-weight:700">2027.05.01 · MJ컨벤션</p><h1 style="margin:0 0 14px;font-size:22px;line-height:1.35">${escapeHtml(notification.title)}</h1><p style="margin:0 0 24px;font-size:15px;line-height:1.7">${escapeHtml(notification.body)}</p><a href="${escapeHtml(url)}" style="display:inline-block;background:#52685a;color:#ffffff;text-decoration:none;padding:12px 18px;font-weight:700">관리자 화면에서 확인</a></div><p style="margin:12px 0 0;color:#748077;font-size:11px;text-align:center">이 메일은 모바일 청첩장 응답으로 자동 발송되었습니다.</p></div></body></html>`
  });
  return true;
}
