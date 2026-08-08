import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const lowPowerSoakProfileId = "android-chromium-low-power-cold-thermal";
export const requiredLowPowerRuns = 3;
export const retainedLowPowerTrendRuns = 12;
export const requiredCrossRunMedianSamples = 3;

const crossRunMedianPolicies = Object.freeze([
  { key: "averageFps", direction: "minimum", ratio: 0.8, noiseFloor: 0 },
  { key: "p95FrameMs", direction: "maximum", ratio: 1.5, noiseFloor: 8 },
  { key: "p99FrameMs", direction: "maximum", ratio: 1.5, noiseFloor: 16 },
  { key: "inputLatencyMs", direction: "maximum", ratio: 1.5, noiseFloor: 20 },
  { key: "settleLatencyMs", direction: "maximum", ratio: 1.5, noiseFloor: 40 },
  { key: "transitionP95FrameMs", direction: "maximum", ratio: 1.5, noiseFloor: 40 },
  { key: "transitionP99FrameMs", direction: "maximum", ratio: 1.5, noiseFloor: 60 },
  { key: "maxTransitionDurationMs", direction: "maximum", ratio: 1.5, noiseFloor: 150 },
  { key: "maxCenterErrorPx", direction: "maximum", ratio: 1.5, noiseFloor: 0.25 },
  { key: "settledJitterPx", direction: "maximum", ratio: 1.5, noiseFloor: 0.5 },
  { key: "maximumImageDecodeReadyMs", direction: "maximum", ratio: 1.5, noiseFloor: 100 }
]);

const transientIssuePatterns = Object.freeze([
  /^낮은 프레임 /,
  /^p95 프레임 /,
  /^p99 프레임 /,
  /^구역 전환 p95 프레임 /,
  /^구역 전환 p99 프레임 /,
  /^이동 입력 지연 /,
  /^카메라 안정화 지연 /
]);

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) throw new TypeError("Median values must contain at least one finite number");
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function isTransientLowPowerIssue(issue) {
  return transientIssuePatterns.some((pattern) => pattern.test(String(issue)));
}

export function assessCrossRunMedianDrift(previousRuns, currentRun) {
  const previousPassedRuns = (Array.isArray(previousRuns) ? previousRuns : [])
    .filter(({ status, medians }) => status === "passed" && medians && typeof medians === "object")
    .slice(-(requiredCrossRunMedianSamples - 1));
  const sampleCount = previousPassedRuns.length + 1;
  if (sampleCount < requiredCrossRunMedianSamples) {
    return {
      status: "warming",
      sampleCount,
      requiredSampleCount: requiredCrossRunMedianSamples,
      baselineRunIds: previousPassedRuns.map(({ runId }) => runId).filter(Boolean),
      comparisons: [],
      issues: []
    };
  }
  const comparisons = crossRunMedianPolicies.map((policy) => {
    const baseline = round(median(previousPassedRuns.map(({ medians }) => medians[policy.key])));
    const current = Number(currentRun.medians?.[policy.key]);
    const limit = policy.direction === "minimum"
      ? round(baseline * policy.ratio)
      : round(Math.max(baseline * policy.ratio, baseline + policy.noiseFloor));
    const passed = Number.isFinite(current) && (policy.direction === "minimum"
      ? current >= limit
      : current <= limit);
    return { key: policy.key, direction: policy.direction, baseline, current, limit, passed };
  });
  const issues = comparisons.filter(({ passed }) => !passed).map(({ key, direction, current, limit }) => (
    `CI 실행 간 ${key} ${current} ${direction === "minimum" ? "<" : ">"} ${limit}`
  ));
  return {
    status: issues.length === 0 ? "passed" : "failed",
    sampleCount,
    requiredSampleCount: requiredCrossRunMedianSamples,
    baselineRunIds: previousPassedRuns.map(({ runId }) => runId).filter(Boolean),
    comparisons,
    issues
  };
}

export function extractLowPowerSoakSample(report, index) {
  const profile = report.reports?.find(({ id }) => id === lowPowerSoakProfileId);
  if (!profile) throw new Error(`저전력 감사 ${index + 1}회차 프로필 누락`);
  const metrics = profile.metrics;
  return {
    run: index + 1,
    averageFps: metrics.averageFps,
    baselineFps: metrics.baselineFps,
    frameRatio: metrics.frameRatio,
    p95FrameMs: metrics.frameTimings?.p95FrameMs,
    p99FrameMs: metrics.frameTimings?.p99FrameMs,
    baselineP95FrameMs: metrics.baselineFrameTimings?.p95FrameMs,
    baselineP99FrameMs: metrics.baselineFrameTimings?.p99FrameMs,
    inputLatencyMs: metrics.motionResponse?.inputLatencyMs,
    settleLatencyMs: metrics.motionResponse?.settleLatencyMs,
    transitionP95FrameMs: metrics.zoneTransitionFrameTimings?.p95FrameMs,
    transitionP99FrameMs: metrics.zoneTransitionFrameTimings?.p99FrameMs,
    maxTransitionDurationMs: metrics.zoneTransitions?.maxTransitionDurationMs,
    maxCenterErrorPx: metrics.zoneTransitions?.maxCenterErrorPx,
    settledJitterPx: metrics.zoneTransitions?.maxSettledCameraJitterPx,
    maximumImageDecodeReadyMs: metrics.zoneBottlenecks?.maximumImageDecodeReadyMs,
    worstZoneId: metrics.zoneBottlenecks?.worstZoneId ?? null,
    worstDecodeZoneId: metrics.zoneBottlenecks?.worstDecodeZoneId ?? null,
    structuralIssues: (profile.issues ?? []).filter((issue) => !isTransientLowPowerIssue(issue))
  };
}

export function buildMobileDeviceSoakTrend(reports, metadata = {}) {
  if (!Array.isArray(reports) || reports.length < requiredLowPowerRuns) {
    throw new Error(`저전력 중앙값 표본 부족 ${reports?.length ?? 0}/${requiredLowPowerRuns}`);
  }
  const samples = reports.slice(-requiredLowPowerRuns).map(extractLowPowerSoakSample);
  const medians = Object.fromEntries([
    "averageFps", "baselineFps", "frameRatio", "p95FrameMs", "p99FrameMs",
    "baselineP95FrameMs", "baselineP99FrameMs", "inputLatencyMs", "settleLatencyMs",
    "transitionP95FrameMs", "transitionP99FrameMs", "maxTransitionDurationMs",
    "maxCenterErrorPx", "settledJitterPx", "maximumImageDecodeReadyMs"
  ].map((key) => [key, round(median(samples.map((sample) => sample[key])))]));
  const limits = {
    p95FrameMs: round(Math.max(50, medians.baselineP95FrameMs * 1.8)),
    p99FrameMs: round(Math.max(90, medians.baselineP99FrameMs * 2)),
    inputLatencyMs: 80,
    settleLatencyMs: 320,
    maxTransitionDurationMs: 2_000,
    maxCenterErrorPx: 1.25,
    settledJitterPx: 0.75,
    maximumImageDecodeReadyMs: 2_000
  };
  const issues = samples.flatMap((sample) => sample.structuralIssues.map((issue) => `${sample.run}회차 ${issue}`));
  if ((medians.baselineFps >= 45 && medians.averageFps < 45)
    || (medians.baselineFps < 45 && medians.frameRatio < 0.75)) {
    issues.push(`3회 중앙 FPS ${medians.averageFps} (러너 ${medians.baselineFps})`);
  }
  for (const key of [
    "p95FrameMs", "p99FrameMs", "inputLatencyMs", "settleLatencyMs",
    "maxTransitionDurationMs", "maxCenterErrorPx", "settledJitterPx", "maximumImageDecodeReadyMs"
  ]) {
    if (medians[key] > limits[key]) issues.push(`3회 중앙 ${key} ${medians[key]} > ${limits[key]}`);
  }
  return {
    generatedAt: new Date().toISOString(),
    sha: metadata.sha || null,
    runId: metadata.runId || null,
    refLabel: metadata.refLabel || null,
    profileId: lowPowerSoakProfileId,
    sampleCount: samples.length,
    samples,
    medians,
    limits,
    status: issues.length === 0 ? "passed" : "failed",
    issues
  };
}

export async function writeMobileDeviceSoakTrend({ reports, outputDir, metadata = {} }) {
  await mkdir(outputDir, { recursive: true });
  const trend = buildMobileDeviceSoakTrend(reports, metadata);
  const reportPath = path.join(outputDir, "mobile-device-soak-trend.json");
  const historyPath = path.join(outputDir, "mobile-device-soak-trend-history.json");
  let history = [];
  try {
    const stored = JSON.parse(await readFile(historyPath, "utf8"));
    if (Array.isArray(stored.runs)) history = stored.runs;
  } catch {
    // The first CI run intentionally starts without history.
  }
  const priorRuns = history.filter(({ sha, runId }) => sha !== trend.sha || runId !== trend.runId);
  const crossRunDrift = assessCrossRunMedianDrift(priorRuns, trend);
  trend.crossRunDrift = crossRunDrift;
  trend.issues.push(...crossRunDrift.issues);
  trend.status = trend.issues.length === 0 ? "passed" : "failed";
  const current = {
    generatedAt: trend.generatedAt,
    sha: trend.sha,
    runId: trend.runId,
    refLabel: trend.refLabel,
    status: trend.status,
    medians: trend.medians,
    crossRunDrift: trend.crossRunDrift,
    worstZones: trend.samples.map(({ worstZoneId, worstDecodeZoneId }) => ({ worstZoneId, worstDecodeZoneId }))
  };
  const runs = [...priorRuns, current]
    .slice(-retainedLowPowerTrendRuns);
  await Promise.all([
    writeFile(reportPath, `${JSON.stringify(trend, null, 2)}\n`),
    writeFile(historyPath, `${JSON.stringify({ version: 1, runs }, null, 2)}\n`),
    writeFile(path.join(outputDir, "mobile-device-soak-trend.md"), [
      "# 저전력 3회 중앙값 품질 추세",
      "",
      `- 상태: ${trend.status}`,
      `- 표본: ${trend.sampleCount}회`,
      `- FPS: ${trend.medians.averageFps} / 러너 ${trend.medians.baselineFps}`,
      `- 프레임 p95/p99: ${trend.medians.p95FrameMs}ms / ${trend.medians.p99FrameMs}ms`,
      `- 입력/안정화: ${trend.medians.inputLatencyMs}ms / ${trend.medians.settleLatencyMs}ms`,
      `- 최초 이미지 decode: ${trend.medians.maximumImageDecodeReadyMs}ms`,
      `- 보존된 CI 실행: ${runs.length}/${retainedLowPowerTrendRuns}`,
      `- 실행 간 드리프트: ${trend.crossRunDrift.status} (${trend.crossRunDrift.sampleCount}/${requiredCrossRunMedianSamples})`,
      "",
      ...(trend.issues.length ? trend.issues.map((issue) => `- 실패: ${issue}`) : ["- 실패 항목 없음"]),
      ""
    ].join("\n"))
  ]);
  return { trend, reportPath, historyPath };
}
