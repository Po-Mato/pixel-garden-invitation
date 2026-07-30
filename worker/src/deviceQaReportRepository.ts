import type { DeviceQaDetailAdminState, DeviceQaProfileBreakdown, DeviceQaServerAlert } from "@wedding-game/shared";
import { analyticsLocalDate } from "./invitationAnalyticsRepository";

export type DeviceQaReportInput = {
  invitationId: string;
  clientHash: string;
  platform: "ios" | "android" | "other";
  osName: string;
  osVersion: string;
  browserName: string;
  browserVersion: string;
  status: "complete" | "warning";
  issues: string[];
};

type AlertRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  emailed_at: string | null;
  email_error: string | null;
};

type QaSetting = { email_enabled: number; warning_threshold: number };

export type RecordedDeviceQaAlert = AlertRow & { emailEnabled: boolean; severity: "watch" | "regression" };

async function setting(db: D1Database, invitationId: string): Promise<QaSetting> {
  return await db.prepare(`
    SELECT email_enabled, warning_threshold FROM device_qa_alert_settings WHERE invitation_id = ?
  `).bind(invitationId).first<QaSetting>() ?? { email_enabled: 0, warning_threshold: 3 };
}

export async function recordDeviceQaReport(
  db: D1Database,
  input: DeviceQaReportInput,
  now = new Date()
): Promise<{ accepted: boolean; alert: RecordedDeviceQaAlert | null }> {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?").bind(input.invitationId).first();
  if (!invitation) return { accepted: false, alert: null };
  const createdAt = now.toISOString();
  const localDate = analyticsLocalDate(now);
  await db.prepare("DELETE FROM device_qa_reports WHERE updated_at < ?")
    .bind(new Date(now.getTime() - 90 * 24 * 60 * 60_000).toISOString()).run();
  await db.prepare(`
    INSERT INTO device_qa_reports (
      id, invitation_id, client_hash, local_date, platform, os_name, os_version,
      browser_name, browser_version, status, issues_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (invitation_id, client_hash, local_date) DO UPDATE SET
      platform = excluded.platform,
      os_name = excluded.os_name,
      os_version = excluded.os_version,
      browser_name = excluded.browser_name,
      browser_version = excluded.browser_version,
      status = excluded.status,
      issues_json = excluded.issues_json,
      updated_at = excluded.updated_at
  `).bind(
    `deviceqa_${crypto.randomUUID()}`,
    input.invitationId,
    input.clientHash,
    localDate,
    input.platform,
    input.osName,
    input.osVersion,
    input.browserName,
    input.browserVersion,
    input.status,
    JSON.stringify(input.issues),
    createdAt,
    createdAt
  ).run();

  if (input.status !== "warning") return { accepted: true, alert: null };
  const preferences = await setting(db, input.invitationId);
  const warning = await db.prepare(`
    SELECT COUNT(*) AS count FROM device_qa_reports
    WHERE invitation_id = ? AND platform = ? AND os_name = ? AND os_version = ?
      AND browser_name = ? AND browser_version = ? AND status = 'warning' AND updated_at >= ?
  `).bind(
    input.invitationId,
    input.platform,
    input.osName,
    input.osVersion,
    input.browserName,
    input.browserVersion,
    new Date(now.getTime() - 24 * 60 * 60_000).toISOString()
  ).first<{ count: number }>();
  const warningCount = Number(warning?.count ?? 0);
  if (warningCount < preferences.warning_threshold) return { accepted: true, alert: null };

  const severity = warningCount >= preferences.warning_threshold * 2 ? "regression" : "watch";
  const profile = `${input.osName} ${input.osVersion} · ${input.browserName} ${input.browserVersion}`;
  const issueText = input.issues.length > 0 ? input.issues.join(", ") : "상세 확인 필요";
  const eventKey = `${localDate}:${input.platform}:${input.osName}:${input.osVersion}:${input.browserName}:${input.browserVersion}:${severity}`;
  const alert = await db.prepare(`
    INSERT INTO device_qa_alert_events (id, invitation_id, event_key, title, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (invitation_id, event_key) DO NOTHING
    RETURNING id, title, body, created_at, emailed_at, email_error
  `).bind(
    `deviceqa_alert_${crypto.randomUUID()}`,
    input.invitationId,
    eventKey,
    severity === "regression" ? "기기별 QA 반복 경고" : "기기별 QA 주의 알림",
    `${profile}에서 24시간 동안 경고 ${warningCount}회 · ${issueText}`.slice(0, 240),
    createdAt
  ).first<AlertRow>();
  return {
    accepted: true,
    alert: alert ? { ...alert, emailEnabled: preferences.email_enabled === 1, severity } : null
  };
}

export async function recordDeviceQaAlertEmailResult(
  db: D1Database,
  alertId: string,
  result: { sentAt?: string; error?: string }
) {
  await db.prepare(`
    UPDATE device_qa_alert_events SET emailed_at = ?, email_error = ? WHERE id = ?
  `).bind(result.sentAt ?? null, result.error?.slice(0, 240) ?? null, alertId).run();
}

function emailStatus(row: AlertRow, enabled: boolean, configured: boolean): DeviceQaServerAlert["emailStatus"] {
  if (row.emailed_at) return "sent";
  if (row.email_error) return "failed";
  return enabled && configured ? "pending" : "disabled";
}

export async function getDeviceQaDetailAdminState(
  db: D1Database,
  invitationId: string,
  emailConfigured: boolean,
  now = new Date()
): Promise<DeviceQaDetailAdminState | null> {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?").bind(invitationId).first();
  if (!invitation) return null;
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString();
  const [profileRows, issueRows, alertRows, preferences] = await Promise.all([
    db.prepare(`
      SELECT platform, os_name, os_version, browser_name, browser_version,
        COUNT(*) AS reports,
        SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) AS warnings,
        SUM(json_array_length(issues_json)) AS issues
      FROM device_qa_reports WHERE invitation_id = ? AND updated_at >= ?
      GROUP BY platform, os_name, os_version, browser_name, browser_version
      ORDER BY warnings DESC, issues DESC, reports DESC LIMIT 12
    `).bind(invitationId, since).all<Record<string, string | number>>(),
    db.prepare(`
      SELECT platform, os_name, os_version, browser_name, browser_version, value AS issue, COUNT(*) AS count
      FROM device_qa_reports, json_each(device_qa_reports.issues_json)
      WHERE invitation_id = ? AND updated_at >= ?
      GROUP BY platform, os_name, os_version, browser_name, browser_version, value
      ORDER BY count DESC
    `).bind(invitationId, since).all<Record<string, string | number>>(),
    db.prepare(`
      SELECT id, title, body, created_at, emailed_at, email_error
      FROM device_qa_alert_events WHERE invitation_id = ?
      ORDER BY created_at DESC, id DESC LIMIT 12
    `).bind(invitationId).all<AlertRow>(),
    setting(db, invitationId)
  ]);
  const issueMap = new Map<string, Array<{ key: string; count: number }>>();
  (issueRows.results ?? []).forEach((row) => {
    const key = [row.platform, row.os_name, row.os_version, row.browser_name, row.browser_version].join("|");
    const values = issueMap.get(key) ?? [];
    values.push({ key: String(row.issue), count: Number(row.count) });
    issueMap.set(key, values);
  });
  const profiles: DeviceQaProfileBreakdown[] = (profileRows.results ?? []).map((row) => {
    const key = [row.platform, row.os_name, row.os_version, row.browser_name, row.browser_version].join("|");
    const reports = Number(row.reports);
    const issues = Number(row.issues);
    return {
      key,
      platform: row.platform as DeviceQaProfileBreakdown["platform"],
      osLabel: `${row.os_name} ${row.os_version}`,
      browserLabel: `${row.browser_name} ${row.browser_version}`,
      reports,
      warnings: Number(row.warnings),
      issues,
      issueRate: reports > 0 ? issues / reports : 0,
      topIssues: (issueMap.get(key) ?? []).slice(0, 3)
    };
  });
  const alerts = (alertRows.results ?? []).map((row): DeviceQaServerAlert => ({
    id: row.id,
    severity: row.title.includes("반복") ? "regression" : "watch",
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    emailStatus: emailStatus(row, preferences.email_enabled === 1, emailConfigured)
  }));
  return {
    profiles,
    latestAlert: alerts[0] ?? null,
    recentAlerts: alerts,
    emailConfigured,
    emailEnabled: preferences.email_enabled === 1,
    warningThreshold: preferences.warning_threshold,
    generatedAt: now.toISOString()
  };
}

export async function updateDeviceQaAlertSettings(
  db: D1Database,
  invitationId: string,
  input: { emailEnabled: boolean; warningThreshold: number },
  now = new Date()
) {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?").bind(invitationId).first();
  if (!invitation) return false;
  await db.prepare(`
    INSERT INTO device_qa_alert_settings (invitation_id, email_enabled, warning_threshold, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (invitation_id) DO UPDATE SET
      email_enabled = excluded.email_enabled,
      warning_threshold = excluded.warning_threshold,
      updated_at = excluded.updated_at
  `).bind(invitationId, input.emailEnabled ? 1 : 0, input.warningThreshold, now.toISOString()).run();
  return true;
}
