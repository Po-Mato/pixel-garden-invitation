import type { InvitationPerformanceConfig } from "@wedding-game/shared";
import type { Env } from "./index";

type PerformanceAggregateRow = {
  fps_sample_count: number | null;
  fps_value_sum: number | null;
  downgrade_count: number | null;
};

const minimumObservedSamples = 20;

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
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?")
    .bind(invitationId)
    .first<{ id: string }>();
  if (!invitation) return null;

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

  return deriveInvitationPerformanceConfig(row ?? {
    fps_sample_count: 0,
    fps_value_sum: 0,
    downgrade_count: 0
  }, now.toISOString());
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=3600" : "no-store"
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
