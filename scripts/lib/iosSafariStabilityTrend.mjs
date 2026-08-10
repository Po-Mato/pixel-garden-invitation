export const iosSafariStabilityPolicy = Object.freeze({
  observedWindow: 10,
  requiredHardenedRuns: 10,
  minimumSuccessRate: 0.9,
  maximumP95DurationMs: 20 * 60_000,
  maximumP95SetupDurationMs: 8 * 60_000,
  maximumP95CaptureDurationMs: 12 * 60_000,
  maximumConsecutiveFailures: 1,
  requiredFaultRecoveryStrategies: ["activate-refresh", "recreate-session"],
  retainedRuns: 30,
  policyRevision: 3
});

function runIdentity(sample) {
  if (sample.runId) return String(sample.runId);
  return `${sample.sha || "unknown"}:${sample.runAttempt || 1}:${sample.generatedAt || "unknown"}`;
}

function normalizedSample(sample = {}) {
  return {
    runId: sample.runId ? String(sample.runId) : null,
    runAttempt: Number(sample.runAttempt) || 1,
    sha: sample.sha ? String(sample.sha) : null,
    outcome: ["success", "failure", "cancelled"].includes(sample.outcome) ? sample.outcome : "failure",
    durationMs: Math.max(0, Number(sample.durationMs) || 0),
    setupDurationMs: Math.max(0, Number(sample.setupDurationMs) || 0),
    captureDurationMs: Math.max(0, Number(sample.captureDurationMs) || 0),
    compositorRecoveryCount: Math.max(0, Number(sample.compositorRecoveryCount) || 0),
    compositorRecoveryDurationMs: Math.max(0, Number(sample.compositorRecoveryDurationMs) || 0),
    compositorFaultInjected: sample.compositorFaultInjected === true || sample.compositorFaultInjected === "true",
    compositorFaultRecovered: sample.compositorFaultRecovered === true || sample.compositorFaultRecovered === "true",
    compositorRecoveryStrategy: ["activate-refresh", "recreate-session"].includes(sample.compositorRecoveryStrategy)
      ? sample.compositorRecoveryStrategy : null,
    wdaMode: sample.wdaMode === "preinstalled" ? "preinstalled" : "source-build",
    generatedAt: sample.generatedAt || new Date().toISOString(),
    policyRevision: Number(sample.policyRevision) || 0,
    url: sample.url || null
  };
}

export function mergeIosSafariStabilityHistory(previousSamples, nextSamples) {
  const byRun = new Map();
  for (const sample of [...(previousSamples ?? []), ...(nextSamples ?? [])]) {
    const normalized = normalizedSample(sample);
    const identity = runIdentity(normalized);
    const existing = byRun.get(identity);
    if (!existing || normalized.policyRevision >= existing.policyRevision) {
      byRun.set(identity, normalized);
    }
  }
  return [...byRun.values()]
    .sort((left, right) => Date.parse(left.generatedAt) - Date.parse(right.generatedAt))
    .slice(-iosSafariStabilityPolicy.retainedRuns);
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function consecutiveFailures(samples) {
  let maximum = 0;
  let current = 0;
  for (const sample of samples) {
    if (sample.outcome === "success") current = 0;
    else {
      current += 1;
      maximum = Math.max(maximum, current);
    }
  }
  return maximum;
}

function summarize(samples) {
  const successes = samples.filter(({ outcome }) => outcome === "success").length;
  const successRate = samples.length === 0 ? 0 : successes / samples.length;
  const setupDurations = samples.map(({ setupDurationMs }) => setupDurationMs).filter((value) => value > 0);
  const captureDurations = samples.map(({ captureDurationMs }) => captureDurationMs).filter((value) => value > 0);
  const recoverySamples = samples.filter(({ compositorRecoveryCount }) => compositorRecoveryCount > 0);
  const faultInjectionSamples = samples.filter(({ compositorFaultInjected }) => compositorFaultInjected);
  const recoveryStrategies = Object.fromEntries(iosSafariStabilityPolicy.requiredFaultRecoveryStrategies.map((strategy) => {
    const strategySamples = faultInjectionSamples.filter(({ compositorRecoveryStrategy }) => compositorRecoveryStrategy === strategy);
    return [strategy, {
      samples: strategySamples.length,
      successes: strategySamples.filter(({ compositorFaultRecovered }) => compositorFaultRecovered).length
    }];
  }));
  return {
    sampleCount: samples.length,
    successes,
    failures: samples.length - successes,
    successRate,
    p95DurationMs: percentile(samples.map(({ durationMs }) => durationMs), 0.95),
    p95SetupDurationMs: percentile(setupDurations, 0.95),
    p95CaptureDurationMs: percentile(captureDurations, 0.95),
    phaseTimingSamples: Math.min(setupDurations.length, captureDurations.length),
    preinstalledWdaSamples: samples.filter(({ wdaMode }) => wdaMode === "preinstalled").length,
    recoveryRuns: recoverySamples.length,
    recoveryRate: samples.length === 0 ? 0 : recoverySamples.length / samples.length,
    p95RecoveryDurationMs: percentile(
      recoverySamples.map(({ compositorRecoveryDurationMs }) => compositorRecoveryDurationMs),
      0.95
    ),
    faultInjectionSamples: faultInjectionSamples.length,
    successfulFaultRecoveries: faultInjectionSamples.filter(({ compositorFaultRecovered }) => compositorFaultRecovered).length,
    recoveryStrategies,
    maximumConsecutiveFailures: consecutiveFailures(samples),
    runIds: samples.map(({ runId }) => runId).filter(Boolean)
  };
}

function policyIssues(summary, { requireRecoveryStrategies = false } = {}) {
  const issues = [];
  if (summary.successRate < iosSafariStabilityPolicy.minimumSuccessRate) {
    issues.push(`성공률 ${Math.round(summary.successRate * 100)}%/${Math.round(iosSafariStabilityPolicy.minimumSuccessRate * 100)}%`);
  }
  if (summary.p95DurationMs > iosSafariStabilityPolicy.maximumP95DurationMs) {
    issues.push(`p95 실행 시간 ${Math.round(summary.p95DurationMs / 1000)}초/${Math.round(iosSafariStabilityPolicy.maximumP95DurationMs / 1000)}초`);
  }
  if (
    summary.p95SetupDurationMs > 0
    && summary.p95SetupDurationMs > iosSafariStabilityPolicy.maximumP95SetupDurationMs
  ) {
    issues.push(`p95 준비 시간 ${Math.round(summary.p95SetupDurationMs / 1000)}초/${Math.round(iosSafariStabilityPolicy.maximumP95SetupDurationMs / 1000)}초`);
  }
  if (
    summary.p95CaptureDurationMs > 0
    && summary.p95CaptureDurationMs > iosSafariStabilityPolicy.maximumP95CaptureDurationMs
  ) {
    issues.push(`p95 캡처 시간 ${Math.round(summary.p95CaptureDurationMs / 1000)}초/${Math.round(iosSafariStabilityPolicy.maximumP95CaptureDurationMs / 1000)}초`);
  }
  if (summary.maximumConsecutiveFailures > iosSafariStabilityPolicy.maximumConsecutiveFailures) {
    issues.push(`연속 실패 ${summary.maximumConsecutiveFailures}회/${iosSafariStabilityPolicy.maximumConsecutiveFailures}회`);
  }
  if (requireRecoveryStrategies) {
    for (const strategy of iosSafariStabilityPolicy.requiredFaultRecoveryStrategies) {
      const coverage = summary.recoveryStrategies[strategy];
      if (!coverage || coverage.samples < 1 || coverage.successes < coverage.samples) {
        issues.push(`${strategy} 합성기 복구 표본 ${coverage?.successes ?? 0}/${coverage?.samples ?? 0}`);
      }
    }
  }
  return issues;
}

export function buildIosSafariStabilityTrend(samples) {
  const ordered = mergeIosSafariStabilityHistory([], samples);
  const observedSamples = ordered.slice(-iosSafariStabilityPolicy.observedWindow);
  const hardenedSamples = ordered
    .filter(({ policyRevision }) => policyRevision === iosSafariStabilityPolicy.policyRevision)
    .slice(-iosSafariStabilityPolicy.requiredHardenedRuns);
  const observed = summarize(observedSamples);
  const observedIssues = observed.sampleCount < iosSafariStabilityPolicy.observedWindow
    ? [`관측 표본 ${observed.sampleCount}/${iosSafariStabilityPolicy.observedWindow}`]
    : policyIssues(observed);
  const acceptance = summarize(hardenedSamples);
  const acceptanceIssues = acceptance.sampleCount < iosSafariStabilityPolicy.requiredHardenedRuns
    ? [`Prebuilt WDA 적용 이후 표본 ${acceptance.sampleCount}/${iosSafariStabilityPolicy.requiredHardenedRuns}`]
    : policyIssues(acceptance, { requireRecoveryStrategies: true });
  return {
    policy: iosSafariStabilityPolicy,
    observed: {
      ...observed,
      status: observed.sampleCount < iosSafariStabilityPolicy.observedWindow
        ? "warming" : observedIssues.length === 0 ? "passed" : "watch",
      issues: observedIssues
    },
    acceptance: {
      ...acceptance,
      status: acceptance.sampleCount < iosSafariStabilityPolicy.requiredHardenedRuns
        ? "warming" : acceptanceIssues.length === 0 ? "passed" : "failed",
      issues: acceptanceIssues
    }
  };
}

export function formatIosSafariStabilityMarkdown(trend) {
  const format = (summary) => `${summary.successes}/${summary.sampleCount} 성공`
    + ` · ${Math.round(summary.successRate * 100)}%`
    + ` · p95 ${Math.round(summary.p95DurationMs / 1000)}초`
    + ` · 최대 연속 실패 ${summary.maximumConsecutiveFailures}회`;
  const phase = trend.acceptance.phaseTimingSamples > 0
    ? ` · 준비 p95 ${Math.round(trend.acceptance.p95SetupDurationMs / 1000)}초`
      + ` · 캡처 p95 ${Math.round(trend.acceptance.p95CaptureDurationMs / 1000)}초`
      + ` · Prebuilt WDA ${trend.acceptance.preinstalledWdaSamples}/${trend.acceptance.sampleCount}`
    : "";
  const compositor = ` · compositor 복구 ${trend.acceptance.recoveryRuns}/${trend.acceptance.sampleCount}`
    + ` · 복구 p95 ${Math.round(trend.acceptance.p95RecoveryDurationMs / 1000)}초`
    + ` · 주입 복구 ${trend.acceptance.successfulFaultRecoveries}/${trend.acceptance.faultInjectionSamples}`
    + ` · activate ${trend.acceptance.recoveryStrategies["activate-refresh"].successes}/${trend.acceptance.recoveryStrategies["activate-refresh"].samples}`
    + ` · recreate ${trend.acceptance.recoveryStrategies["recreate-session"].successes}/${trend.acceptance.recoveryStrategies["recreate-session"].samples}`;
  return [
    "## iOS Safari CI 안정성 추세",
    "",
    `- 최근 실행 10회: **${trend.observed.status}** · ${format(trend.observed)}`,
    `- Prebuilt WDA 적용 후: **${trend.acceptance.status}** · ${format(trend.acceptance)}${phase}${compositor}`,
    "",
    ...[...trend.observed.issues, ...trend.acceptance.issues].map((issue) => `- ${issue}`),
    ""
  ].join("\n");
}
