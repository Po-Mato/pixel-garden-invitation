export const qualityCiEfficiencyPolicy = Object.freeze({
  expectedWorkflows: ["pages", "mobile", "android", "ios"],
  minimumDependencyCacheHitRate: 0.75,
  maximumSharedArtifactBytes: 70 * 1024 * 1024
});

function truthy(value) {
  return value === true || value === "true";
}

function normalize(sample = {}) {
  return {
    workflow: String(sample.workflow ?? "unknown"),
    variant: sample.variant === "device" ? "device" : "production",
    dependencyCacheHit: truthy(sample.dependencyCacheHit),
    dependencySetupDurationMs: Math.max(0, Number(sample.dependencySetupDurationMs) || 0),
    buildRestored: truthy(sample.buildRestored),
    restoreDurationMs: Math.max(0, Number(sample.restoreDurationMs) || 0),
    artifactBytes: Math.max(0, Number(sample.artifactBytes) || 0),
    producerBuildDurationMs: Math.max(0, Number(sample.producerBuildDurationMs) || 0),
    fallbackBuildDurationMs: Math.max(0, Number(sample.fallbackBuildDurationMs) || 0),
    runId: sample.runId ? String(sample.runId) : null,
    sha: sample.sha ? String(sample.sha) : null,
    generatedAt: sample.generatedAt ?? new Date().toISOString()
  };
}

export function buildQualityCiEfficiency(samples = []) {
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
  return {
    version: 1,
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
    cacheBudget,
    issues
  };
}

export function formatQualityCiEfficiencyMarkdown(summary) {
  const { metrics } = summary;
  return [
    "## 품질 CI 효율",
    "",
    `- 상태: **${summary.status}** · 보고 ${metrics.reportCount}/${summary.policy.expectedWorkflows.length}`,
    `- 의존성 캐시: ${metrics.dependencyCacheHits}/${metrics.reportCount} · ${Math.round(metrics.dependencyCacheHitRate * 100)}% · 예산 ${summary.cacheBudget.status}`,
    `- 공통 빌드 재사용: ${metrics.sharedBuildRestores}/${metrics.reportCount} · 산출물 ${metrics.artifactBytes} bytes`,
    `- 추정 절약: ${Math.round(metrics.estimatedSavedMs / 1000)}초 · 복원 대기 ${Math.round(metrics.totalRestoreDurationMs / 1000)}초`,
    ...summary.issues.map((issue) => `- ${issue}`),
    ""
  ].join("\n");
}
