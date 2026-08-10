export const qualityCiEfficiencyPolicy = Object.freeze({
  expectedWorkflows: ["pages", "mobile", "android", "ios"],
  minimumDependencyCacheHitRate: 0.75,
  maximumSharedArtifactBytes: 70 * 1024 * 1024,
  retainedRuns: 160,
  pricingVerifiedAt: "2026-08-10",
  pricingReference: "https://docs.github.com/en/billing/concepts/product-billing/github-actions",
  standardRunnerUsdPerMinute: Object.freeze({ linux: 0.006, macos: 0.062 })
});

function truthy(value) {
  return value === true || value === "true";
}

function normalizeRunnerOs(value, workflow) {
  if (value === "macos" || value === "linux") return value;
  return workflow === "ios" ? "macos" : "linux";
}

function normalize(sample = {}) {
  const workflow = String(sample.workflow ?? "unknown");
  const runDurationMs = Math.max(0, Number(sample.runDurationMs) || 0);
  return {
    workflow,
    variant: sample.variant === "device" ? "device" : "production",
    dependencyCacheHit: truthy(sample.dependencyCacheHit),
    dependencySetupDurationMs: Math.max(0, Number(sample.dependencySetupDurationMs) || 0),
    buildRestored: truthy(sample.buildRestored),
    restoreDurationMs: Math.max(0, Number(sample.restoreDurationMs) || 0),
    artifactBytes: Math.max(0, Number(sample.artifactBytes) || 0),
    producerBuildDurationMs: Math.max(0, Number(sample.producerBuildDurationMs) || 0),
    fallbackBuildDurationMs: Math.max(0, Number(sample.fallbackBuildDurationMs) || 0),
    runDurationMs,
    billedMinutes: Math.max(0, Number(sample.billedMinutes) || (runDurationMs > 0 ? Math.ceil(runDurationMs / 60_000) : 0)),
    jobCount: Math.max(0, Number(sample.jobCount) || 0),
    runnerOs: normalizeRunnerOs(sample.runnerOs, workflow),
    runId: sample.runId ? String(sample.runId) : null,
    sha: sample.sha ? String(sample.sha) : null,
    generatedAt: sample.generatedAt ?? new Date().toISOString()
  };
}

function runIdentity(sample) {
  return `${sample.workflow}:${sample.runId || sample.sha || sample.generatedAt}`;
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function timingSummary(samples) {
  const setup = samples.map(({ dependencySetupDurationMs }) => dependencySetupDurationMs).filter((value) => value > 0);
  const runs = samples.map(({ runDurationMs }) => runDurationMs).filter((value) => value > 0);
  return {
    sampleCount: samples.length,
    runTimingSamples: runs.length,
    p50SetupDurationMs: percentile(setup, 0.5),
    p95SetupDurationMs: percentile(setup, 0.95),
    p50RunDurationMs: percentile(runs, 0.5),
    p95RunDurationMs: percentile(runs, 0.95)
  };
}

export function mergeQualityCiRunTimings(samples = [], timings = []) {
  const timingByRun = new Map(timings.map((timing) => [
    `${String(timing.workflow ?? "unknown")}:${String(timing.runId ?? "")}`,
    timing
  ]));
  return samples.map((sample) => {
    const timing = timingByRun.get(`${String(sample.workflow ?? "unknown")}:${String(sample.runId ?? "")}`);
    return timing ? { ...sample, ...timing, workflow: sample.workflow, runId: sample.runId } : sample;
  });
}

export function mergeQualityCiEfficiencyHistory(history = {}, incoming = []) {
  const byRun = new Map();
  for (const raw of [...(history.samples ?? []), ...incoming]) {
    const sample = normalize(raw);
    byRun.set(runIdentity(sample), sample);
  }
  return {
    version: 1,
    samples: [...byRun.values()]
      .sort((left, right) => Date.parse(left.generatedAt) - Date.parse(right.generatedAt))
      .slice(-qualityCiEfficiencyPolicy.retainedRuns)
  };
}

function buildTrend(history, repositoryVisibility, generatedAt) {
  const samples = history.samples ?? [];
  const warm = samples.filter(({ dependencyCacheHit }) => dependencyCacheHit);
  const cold = samples.filter(({ dependencyCacheHit }) => !dependencyCacheHit);
  const month = String(generatedAt).slice(0, 7);
  const monthlySamples = samples.filter(({ generatedAt: value }) => String(value).slice(0, 7) === month);
  const billedEquivalentUsd = monthlySamples.reduce((total, sample) => (
    total + sample.billedMinutes * qualityCiEfficiencyPolicy.standardRunnerUsdPerMinute[sample.runnerOs]
  ), 0);
  return {
    sampleCount: samples.length,
    cacheTiming: {
      cold: timingSummary(cold),
      warm: timingSummary(warm)
    },
    monthly: {
      month,
      workflowRuns: monthlySamples.length,
      runnerMinutes: monthlySamples.reduce((total, { runDurationMs }) => total + runDurationMs, 0) / 60_000,
      billedEquivalentMinutes: monthlySamples.reduce((total, { billedMinutes }) => total + billedMinutes, 0),
      billedEquivalentUsd: Math.round(billedEquivalentUsd * 1000) / 1000,
      estimatedChargeUsd: repositoryVisibility === "public" ? 0 : Math.round(billedEquivalentUsd * 1000) / 1000,
      repositoryVisibility,
      publicStandardRunnersFree: repositoryVisibility === "public"
    }
  };
}

export function buildQualityCiEfficiency(samples = [], history = {}, metadata = {}) {
  const latest = new Map();
  for (const sample of samples.map(normalize)) latest.set(sample.workflow, sample);
  const reports = [...latest.values()].sort((left, right) => left.workflow.localeCompare(right.workflow));
  const expected = qualityCiEfficiencyPolicy.expectedWorkflows;
  const missingWorkflows = expected.filter((workflow) => !latest.has(workflow));
  const expectedReports = reports.filter(({ workflow }) => expected.includes(workflow));
  const cacheHits = expectedReports.filter(({ dependencyCacheHit }) => dependencyCacheHit).length;
  const restoredBuilds = expectedReports.filter(({ buildRestored }) => buildRestored).length;
  const artifactBytes = Math.max(0, ...expectedReports.map((sample) => sample.artifactBytes));
  const estimatedSavedMs = expectedReports.reduce((total, sample) => (
    total + (sample.buildRestored ? sample.producerBuildDurationMs : 0)
  ), 0);
  const issues = [];
  if (missingWorkflows.length > 0) issues.push(`CI 효율 보고 누락: ${missingWorkflows.join(", ")}`);
  if (expectedReports.some(({ buildRestored }) => !buildRestored)) {
    issues.push(`공통 빌드 재사용 ${restoredBuilds}/${expectedReports.length}`);
  }
  if (artifactBytes > qualityCiEfficiencyPolicy.maximumSharedArtifactBytes) {
    issues.push(`공통 빌드 크기 ${artifactBytes}/${qualityCiEfficiencyPolicy.maximumSharedArtifactBytes} bytes`);
  }
  const dependencyCacheHitRate = expectedReports.length === 0 ? 0 : cacheHits / expectedReports.length;
  const cacheBudget = {
    status: expectedReports.length < expected.length
      ? "warming"
      : dependencyCacheHitRate >= qualityCiEfficiencyPolicy.minimumDependencyCacheHitRate ? "passed" : "watch",
    hitRate: dependencyCacheHitRate,
    target: qualityCiEfficiencyPolicy.minimumDependencyCacheHitRate
  };
  const generatedAt = metadata.generatedAt ?? new Date().toISOString();
  const nextHistory = mergeQualityCiEfficiencyHistory(history, expectedReports);
  return {
    version: 2,
    generatedAt,
    status: issues.length > 0 ? "failed" : "passed",
    policy: qualityCiEfficiencyPolicy,
    reports,
    metrics: {
      reportCount: expectedReports.length,
      dependencyCacheHits: cacheHits,
      dependencyCacheHitRate,
      sharedBuildRestores: restoredBuilds,
      sharedBuildRestoreRate: expectedReports.length === 0 ? 0 : restoredBuilds / expectedReports.length,
      artifactBytes,
      totalDependencySetupDurationMs: expectedReports.reduce((sum, sample) => sum + sample.dependencySetupDurationMs, 0),
      totalRestoreDurationMs: expectedReports.reduce((sum, sample) => sum + sample.restoreDurationMs, 0),
      estimatedSavedMs,
      fallbackBuildDurationMs: expectedReports.reduce((sum, sample) => sum + sample.fallbackBuildDurationMs, 0)
    },
    trend: buildTrend(nextHistory, metadata.repositoryVisibility ?? "public", generatedAt),
    cacheBudget,
    issues
  };
}

export function formatQualityCiEfficiencyMarkdown(summary) {
  const { metrics, trend } = summary;
  const cold = trend.cacheTiming.cold;
  const warm = trend.cacheTiming.warm;
  return [
    "## 품질 CI 효율",
    "",
    `- 상태: **${summary.status}** · 보고 ${metrics.reportCount}/${summary.policy.expectedWorkflows.length}`,
    `- 의존성 캐시: ${metrics.dependencyCacheHits}/${metrics.reportCount} · ${Math.round(metrics.dependencyCacheHitRate * 100)}% · 예산 ${summary.cacheBudget.status}`,
    `- 공통 빌드 재사용: ${metrics.sharedBuildRestores}/${metrics.reportCount} · 산출물 ${metrics.artifactBytes} bytes`,
    `- 추정 절약: ${Math.round(metrics.estimatedSavedMs / 1000)}초 · 복원 대기 ${Math.round(metrics.totalRestoreDurationMs / 1000)}초`,
    `- cold cache ${cold.sampleCount}회: 준비 p50/p95 ${Math.round(cold.p50SetupDurationMs / 1000)}/${Math.round(cold.p95SetupDurationMs / 1000)}초 · 전체 p50/p95 ${Math.round(cold.p50RunDurationMs / 1000)}/${Math.round(cold.p95RunDurationMs / 1000)}초`,
    `- warm cache ${warm.sampleCount}회: 준비 p50/p95 ${Math.round(warm.p50SetupDurationMs / 1000)}/${Math.round(warm.p95SetupDurationMs / 1000)}초 · 전체 p50/p95 ${Math.round(warm.p50RunDurationMs / 1000)}/${Math.round(warm.p95RunDurationMs / 1000)}초`,
    `- ${trend.monthly.month} 표준 러너 ${Math.round(trend.monthly.runnerMinutes)}분 · 공개 저장소 예상 과금 $${trend.monthly.estimatedChargeUsd.toFixed(2)} · 유료 환산 $${trend.monthly.billedEquivalentUsd.toFixed(2)}`,
    ...summary.issues.map((issue) => `- ${issue}`),
    ""
  ].join("\n");
}
