import type {
  InvitationPerformanceAdminState,
  InvitationPerformanceConfig
} from "@wedding-game/shared";
import type { Env } from "./index";

type PerformanceAggregateRow = {
  fps_sample_count: number | null;
  fps_value_sum: number | null;
  downgrade_count: number | null;
};

const minimumObservedSamples = 20;

type PerformanceSettingRow = {
  force_default: number;
  updated_at: string;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function deriveInvitationPerformanceConfig(
  aggregate: PerformanceAggregateRow,
  generatedAt = new Date().toISOString()
): InvitationPerformanceConfig {
  const sampleCount = Math.max(0, aggregate.fps_sample_count ?? 0);
  const valueSum = Math.max(0, aggregate.fps_value_sum ?? 0);
  if (sampleCount < minimumObservedSamples || valueSum <= 0) {
    return {
      version: 1,
      source: "default",
      sampleCount,
      observedAverageFps: null,
      slowFpsThreshold: 42,
      recoveryFpsThreshold: 52,
      slowWindowsRequired: 2,
      recoveryWindowsRequired: 4,
      generatedAt
    };
  }

  const observedAverageFps = Math.round(valueSum / sampleCount);
  const slowFpsThreshold = clamp(Math.round(observedAverageFps - 9), 34, 45);
  const recoveryFpsThreshold = clamp(Math.max(slowFpsThreshold + 8, observedAverageFps - 2), 44, 58);
  const downgradeRate = Math.max(0, aggregate.downgrade_count ?? 0) / sampleCount;
  return {
    version: 1,
    source: "observed",
    sampleCount,
    observedAverageFps,
    slowFpsThreshold,
    recoveryFpsThreshold,
    slowWindowsRequired: downgradeRate >= 0.15 ? 3 : 2,
    recoveryWindowsRequired: 4,
    generatedAt
  };
}

export async function loadInvitationPerformanceConfig(
  db: D1Database,
  invitationId: string,
  now = new Date()
): Promise<InvitationPerformanceConfig | null> {
  const state = await getInvitationPerformanceAdminState(db, invitationId, now);
  return state?.effective ?? null;
}

async function loadPerformanceAggregate(
  db: D1Database,
  invitationId: string,
  now: Date
): Promise<PerformanceAggregateRow> {
  const row = await db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN event_name = 'performance_fps' THEN event_count ELSE 0 END), 0) AS fps_sample_count,
      COALESCE(SUM(CASE WHEN event_name = 'performance_fps' THEN value_sum ELSE 0 END), 0) AS fps_value_sum,
      COALESCE(SUM(CASE WHEN event_name = 'performance_quality_change' AND dimension = 'lite:frame-rate' THEN event_count ELSE 0 END), 0) AS downgrade_count
    FROM invitation_analytics_daily
    WHERE invitation_id = ? AND local_date >= ?
  `).bind(
    invitationId,
    new Date(now.getTime() - 13 * 86_400_000).toISOString().slice(0, 10)
  ).first<PerformanceAggregateRow>();
  return row ?? { fps_sample_count: 0, fps_value_sum: 0, downgrade_count: 0 };
}

export async function getInvitationPerformanceAdminState(
  db: D1Database,
  invitationId: string,
  now = new Date()
): Promise<InvitationPerformanceAdminState | null> {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?")
    .bind(invitationId)
    .first<{ id: string }>();
  if (!invitation) return null;
  const [aggregate, setting] = await Promise.all([
    loadPerformanceAggregate(db, invitationId, now),
    db.prepare(`
      SELECT force_default, updated_at
      FROM invitation_performance_settings
      WHERE invitation_id = ?
    `).bind(invitationId).first<PerformanceSettingRow>()
  ]);
  const generatedAt = now.toISOString();
  const adaptive = deriveInvitationPerformanceConfig(aggregate, generatedAt);
  const forceDefault = setting?.force_default === 1;
  const stableDefault = deriveInvitationPerformanceConfig({
    fps_sample_count: 0,
    fps_value_sum: 0,
    downgrade_count: 0
  }, generatedAt);
  return {
    mode: forceDefault ? "safe-default" : "adaptive",
    effective: forceDefault ? {
      ...stableDefault,
      sampleCount: adaptive.sampleCount,
      observedAverageFps: adaptive.observedAverageFps
    } : adaptive,
    adaptive,
    updatedAt: setting?.updated_at ?? null
  };
}

export async function setInvitationPerformanceMode(
  db: D1Database,
  invitationId: string,
  mode: InvitationPerformanceAdminState["mode"],
  now = new Date()
): Promise<InvitationPerformanceAdminState | null> {
  const current = await getInvitationPerformanceAdminState(db, invitationId, now);
  if (!current) return null;
  await db.prepare(`
    INSERT INTO invitation_performance_settings (invitation_id, force_default, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(invitation_id) DO UPDATE SET
      force_default = excluded.force_default,
      updated_at = excluded.updated_at
  `).bind(invitationId, mode === "safe-default" ? 1 : 0, now.toISOString()).run();
  return getInvitationPerformanceAdminState(db, invitationId, now);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export async function handleInvitationPerformanceConfigRequest(
  request: Request,
  env: Env,
  invitationId: string
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "not_found" }, 404);
  try {
    const config = await loadInvitationPerformanceConfig(env.DB, invitationId);
    return config ? json(config) : json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}
