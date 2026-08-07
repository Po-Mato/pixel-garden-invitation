import type {
  InvitationExperienceQualityGuard,
  InvitationExperienceQualityMetric
} from "@wedding-game/shared";

type QualityDailyRow = {
  local_date: string;
  event_name: "quality_camera_center" | "quality_cls" | "quality_long_frame";
  sample_count: number;
  value_sum: number;
};

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 7;
export const EXPERIENCE_QUALITY_MINIMUM_ACTIVE_DAYS = 7;
export const EXPERIENCE_QUALITY_MINIMUM_SAMPLES = 20;

const definitions = Object.freeze([
  { key: "camera-center", eventName: "quality_camera_center", label: "캐릭터 중심 오차", unit: "px", alertThreshold: 2 },
  { key: "cls", eventName: "quality_cls", label: "화면 배치 흔들림", unit: "score", alertThreshold: 0.1 },
  { key: "long-frame", eventName: "quality_long_frame", label: "긴 프레임 p95", unit: "ms", alertThreshold: 100 }
] as const);

function dateValue(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function addDays(value: string, days: number): string {
  return new Date(dateValue(value) + days * DAY_MS).toISOString().slice(0, 10);
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function metricAverage(eventName: QualityDailyRow["event_name"], valueSum: number, sampleCount: number): number {
  const average = valueSum / sampleCount;
  if (eventName === "quality_cls") return round(average / 1_000, 3);
  if (eventName === "quality_camera_center") return round(average, 1);
  return Math.round(average);
}

function percentile(values: readonly number[], ratio: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] * (1 - (position - lower)) + sorted[upper] * (position - lower);
}

export function buildInvitationExperienceQualityGuard(
  rows: readonly QualityDailyRow[],
  input: { to: string; now?: Date }
): InvitationExperienceQualityGuard {
  const metrics = definitions.map((definition): InvitationExperienceQualityMetric => {
    const matching = rows.filter((row) => row.event_name === definition.eventName);
    const sampleCount = matching.reduce((sum, row) => sum + Number(row.sample_count), 0);
    const valueSum = matching.reduce((sum, row) => sum + Number(row.value_sum), 0);
    const activeDays = new Set(matching.filter((row) => row.sample_count > 0).map((row) => row.local_date)).size;
    const average = sampleCount > 0 ? metricAverage(definition.eventName, valueSum, sampleCount) : null;
    const ready = activeDays >= EXPERIENCE_QUALITY_MINIMUM_ACTIVE_DAYS
      && sampleCount >= EXPERIENCE_QUALITY_MINIMUM_SAMPLES;
    const dailyP95Value = ready ? percentile(matching
      .filter((row) => row.sample_count > 0)
      .map((row) => metricAverage(definition.eventName, Number(row.value_sum), Number(row.sample_count))), 0.95) : null;
    const dailyP95 = dailyP95Value === null ? null : definition.eventName === "quality_cls"
      ? round(dailyP95Value, 3)
      : definition.eventName === "quality_camera_center" ? round(dailyP95Value, 1) : Math.round(dailyP95Value);
    const suggestionValue = dailyP95 === null ? null : Math.max(definition.alertThreshold, dailyP95 * 1.25);
    const suggestedThreshold = suggestionValue === null ? null : definition.eventName === "quality_cls"
      ? round(suggestionValue, 3)
      : definition.eventName === "quality_camera_center" ? round(suggestionValue, 1) : Math.round(suggestionValue);
    return {
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      sampleCount,
      activeDays,
      average,
      alertThreshold: definition.alertThreshold,
      status: !ready ? "collecting" : average !== null && average > definition.alertThreshold ? "watch" : "stable",
      calibration: {
        status: ready ? "ready" : "locked",
        remainingActiveDays: Math.max(0, EXPERIENCE_QUALITY_MINIMUM_ACTIVE_DAYS - activeDays),
        remainingSamples: Math.max(0, EXPERIENCE_QUALITY_MINIMUM_SAMPLES - sampleCount),
        dailyP95,
        suggestedThreshold,
        decision: !ready ? "collect-more" : suggestedThreshold !== null
          && suggestedThreshold > definition.alertThreshold * 1.1 ? "review-increase" : "retain"
      }
    };
  });
  const status = metrics.some((metric) => metric.status === "watch")
    ? "watch"
    : metrics.every((metric) => metric.status === "stable") ? "stable" : "collecting";
  return {
    window: { from: addDays(input.to, -(WINDOW_DAYS - 1)), to: input.to, days: WINDOW_DAYS },
    status,
    minimumActiveDays: EXPERIENCE_QUALITY_MINIMUM_ACTIVE_DAYS,
    minimumSamples: EXPERIENCE_QUALITY_MINIMUM_SAMPLES,
    calibrationStatus: metrics.every((metric) => metric.calibration.status === "ready") ? "ready" : "locked",
    metrics,
    generatedAt: (input.now ?? new Date()).toISOString()
  };
}

export async function getInvitationExperienceQualityGuard(
  db: D1Database,
  invitationId: string,
  input: { to: string; now?: Date }
): Promise<InvitationExperienceQualityGuard> {
  const from = addDays(input.to, -(WINDOW_DAYS - 1));
  const result = await db.prepare(`
    SELECT local_date, event_name, SUM(event_count) AS sample_count, SUM(value_sum) AS value_sum
    FROM invitation_analytics_daily
    WHERE invitation_id = ?
      AND local_date BETWEEN ? AND ?
      AND (
        (event_name = 'quality_camera_center' AND dimension LIKE '%:interior')
        OR event_name IN ('quality_cls', 'quality_long_frame')
      )
    GROUP BY local_date, event_name
    ORDER BY local_date ASC
  `).bind(invitationId, from, input.to).all<QualityDailyRow>();
  return buildInvitationExperienceQualityGuard(result.results ?? [], input);
}
