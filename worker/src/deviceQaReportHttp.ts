import type { Env } from "./index";
import { adminNotificationEmailConfigured, sendDeviceQaAlertEmail } from "./adminNotificationEmail";
import { recordDeviceQaAlertEmailResult, recordDeviceQaReport, type DeviceQaReportInput } from "./deviceQaReportRepository";
import { hashClientKey } from "./security";

const issues = new Set(["viewport", "touch", "storage", "audio", "movement", "portal", "feedback", "layout", "photo"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function clean(value: unknown, maximum: number) {
  return typeof value === "string" && /^[\p{L}\p{N} .+_-]+$/u.test(value.trim()) ? value.trim().slice(0, maximum) : null;
}

function input(value: unknown): Omit<DeviceQaReportInput, "invitationId" | "clientHash"> | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.platform !== "ios" && candidate.platform !== "android" && candidate.platform !== "other") return null;
  const osName = clean(candidate.osName, 24);
  const osVersion = clean(candidate.osVersion, 16);
  const browserName = clean(candidate.browserName, 24);
  const browserVersion = clean(candidate.browserVersion, 16);
  if (!osName || !osVersion || !browserName || !browserVersion) return null;
  if (candidate.status !== "complete" && candidate.status !== "warning") return null;
  if (!Array.isArray(candidate.issues) || candidate.issues.length > 9 || !candidate.issues.every((item) => typeof item === "string" && issues.has(item))) return null;
  return { platform: candidate.platform, osName, osVersion, browserName, browserVersion, status: candidate.status, issues: [...new Set(candidate.issues as string[])] };
}

export async function handleDeviceQaReportRequest(request: Request, env: Env, clientKey: string, invitationId: string) {
  if (request.method !== "POST") return json({ error: "not_found" }, 404);
  if (!env.RSVP_CLIENT_KEY_SECRET) return json({ error: "internal_error" }, 500);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  const report = input(body);
  if (!report) return json({ error: "invalid_request" }, 400);
  try {
    const result = await recordDeviceQaReport(env.DB, {
      ...report,
      invitationId,
      clientHash: await hashClientKey(clientKey, env.RSVP_CLIENT_KEY_SECRET)
    });
    if (!result.accepted) return json({ error: "not_found" }, 404);
    if (result.alert?.emailEnabled && adminNotificationEmailConfigured(env)) {
      try {
        await sendDeviceQaAlertEmail(env, result.alert.title, result.alert.body);
        await recordDeviceQaAlertEmailResult(env.DB, result.alert.id, { sentAt: new Date().toISOString() });
      } catch (error) {
        await recordDeviceQaAlertEmailResult(env.DB, result.alert.id, { error: error instanceof Error ? error.message : "email_failed" });
      }
    }
    return json({ accepted: true });
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}
