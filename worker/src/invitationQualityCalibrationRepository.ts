import type {
  InvitationExperienceQualityGuard,
  InvitationQualityCalibrationAdminState,
  InvitationQualityCalibrationDecision,
  InvitationQualityCalibrationSnapshot
} from "@wedding-game/shared";
import { analyticsLocalDate } from "./invitationAnalyticsRepository";
import { getInvitationExperienceQualityGuard } from "./invitationExperienceQualityGuard";
import { createAdminNotification } from "./adminNotificationRepository";

type SnapshotRow = {
  week_start: string;
  metric_key: InvitationQualityCalibrationSnapshot["metricKey"];
  window_from: string;
  window_to: string;
  active_days: number;
  sample_count: number;
  daily_p95: number;
  suggested_threshold: number;
  current_threshold: number;
  recommendation: InvitationQualityCalibrationSnapshot["recommendation"];
  decision: InvitationQualityCalibrationDecision;
  decision_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const DAY_MS = 86_400_000;

export function qualityCalibrationWeekStart(localDate: string): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid quality calibration date");
  const offset = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
}

function snapshot(row: SnapshotRow): InvitationQualityCalibrationSnapshot {
  return {
    weekStart: row.week_start,
    metricKey: row.metric_key,
    window: { from: row.window_from, to: row.window_to },
    activeDays: Number(row.active_days),
    sampleCount: Number(row.sample_count),
    dailyP95: Number(row.daily_p95),
    suggestedThreshold: Number(row.suggested_threshold),
    currentThreshold: Number(row.current_threshold),
    recommendation: row.recommendation,
    decision: row.decision,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

export async function getInvitationQualityCalibrationAdminState(
  db: D1Database,
  invitationId: string,
  input: { to: string; eligible: boolean; now?: Date }
): Promise<InvitationQualityCalibrationAdminState> {
  const rows = await db.prepare(`
    SELECT week_start, metric_key, window_from, window_to, active_days, sample_count,
      daily_p95, suggested_threshold, current_threshold, recommendation, decision,
      decision_note, created_at, reviewed_at
    FROM invitation_quality_calibration_snapshots
    WHERE invitation_id = ?
    ORDER BY week_start DESC, metric_key ASC
    LIMIT 24
  `).bind(invitationId).all<SnapshotRow>();
  const snapshots = (rows.results ?? []).map(snapshot);
  return {
    currentWeekStart: qualityCalibrationWeekStart(input.to),
    eligible: input.eligible,
    pendingCount: snapshots.filter(({ decision }) => decision === "pending").length,
    snapshots,
    generatedAt: (input.now ?? new Date()).toISOString()
  };
}

export async function ensureInvitationQualityCalibrationSnapshot(
  db: D1Database,
  invitationId: string,
  qualityGuard: InvitationExperienceQualityGuard,
  now = new Date()
): Promise<InvitationQualityCalibrationAdminState> {
  const eligible = qualityGuard.calibrationStatus === "ready";
  if (eligible) {
    const weekStart = qualityCalibrationWeekStart(qualityGuard.window.to);
    const createdAt = now.toISOString();
    const statements = qualityGuard.metrics.map((metric) => db.prepare(`
      INSERT INTO invitation_quality_calibration_snapshots (
        invitation_id, week_start, metric_key, window_from, window_to, active_days,
        sample_count, daily_p95, suggested_threshold, current_threshold,
        recommendation, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (invitation_id, week_start, metric_key) DO NOTHING
    `).bind(
      invitationId,
      weekStart,
      metric.key,
      qualityGuard.window.from,
      qualityGuard.window.to,
      metric.activeDays,
      metric.sampleCount,
      metric.calibration.dailyP95,
      metric.calibration.suggestedThreshold,
      metric.alertThreshold,
      metric.calibration.decision === "review-increase" ? "review-increase" : "retain",
      createdAt
    ));
    await db.batch(statements);
  }
  return getInvitationQualityCalibrationAdminState(db, invitationId, {
    to: qualityGuard.window.to,
    eligible,
    now
  });
}

export async function reviewInvitationQualityCalibrationSnapshot(
  db: D1Database,
  invitationId: string,
  input: {
    weekStart: string;
    metricKey: InvitationQualityCalibrationSnapshot["metricKey"];
    decision: Exclude<InvitationQualityCalibrationDecision, "pending">;
    note?: string;
  },
  now = new Date()
): Promise<InvitationQualityCalibrationAdminState | null> {
  const result = await db.prepare(`
    UPDATE invitation_quality_calibration_snapshots
    SET decision = ?, decision_note = ?, reviewed_at = ?
    WHERE invitation_id = ? AND week_start = ? AND metric_key = ? AND decision = 'pending'
  `).bind(
    input.decision,
    input.note?.trim() || null,
    now.toISOString(),
    invitationId,
    input.weekStart,
    input.metricKey
  ).run();
  if (!result.success || Number(result.meta.changes) !== 1) return null;
  return getInvitationQualityCalibrationAdminState(db, invitationId, {
    to: analyticsLocalDate(now),
    eligible: true,
    now
  });
}

export async function createQualityCalibrationReadyNotification(
  db: D1Database,
  invitationId: string,
  state: InvitationQualityCalibrationAdminState,
  now = new Date()
): Promise<boolean> {
  if (!state.eligible || state.pendingCount < 1) return false;
  const createdAt = now.toISOString();
  const notification = await createAdminNotification(db, {
    id: `notification_${crypto.randomUUID()}`,
    invitationId,
    eventKey: `quality_calibration_ready:${state.currentWeekStart}`,
    kind: "quality_calibration_ready",
    sourceId: state.currentWeekStart,
    title: "주간 품질 보정 검토 준비",
    body: `${state.pendingCount}개 품질 지표의 보정 후보가 준비되었습니다. 기준값은 자동 변경되지 않으며 관리자 검토 후 결정됩니다.`,
    createdAt,
    expiresAt: new Date(now.getTime() + 30 * DAY_MS).toISOString()
  });
  return notification !== null;
}

export async function snapshotReadyInvitationQualityCalibrations(db: D1Database, now = new Date()) {
  const invitations = await db.prepare("SELECT id FROM invitations ORDER BY id ASC").all<{ id: string }>();
  const to = analyticsLocalDate(now);
  let eligibleInvitations = 0;
  let createdNotifications = 0;
  for (const invitation of invitations.results ?? []) {
    const guard = await getInvitationExperienceQualityGuard(db, invitation.id, { to, now });
    if (guard.calibrationStatus !== "ready") continue;
    const state = await ensureInvitationQualityCalibrationSnapshot(db, invitation.id, guard, now);
    if (await createQualityCalibrationReadyNotification(db, invitation.id, state, now)) {
      createdNotifications += 1;
    }
    eligibleInvitations += 1;
  }
  return { checkedInvitations: invitations.results?.length ?? 0, eligibleInvitations, createdNotifications };
}
