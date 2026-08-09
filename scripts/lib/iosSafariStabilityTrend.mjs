export const iosSafariStabilityPolicy = Object.freeze({
  observedWindow: 10,
  requiredHardenedRuns: 10,
  minimumSuccessRate: 0.9,
  maximumP95DurationMs: 20 * 60_000,
  maximumConsecutiveFailures: 1,
  retainedRuns: 30,
  policyRevision: 1
});

function runIdentity(sample) {
  return `${sample.runId || sample.sha || "unknown"}:${sample.runAttempt || 1}`;
}

function normalizedSample(sample = {}) {
  return {
    runId: sample.runId ? String(sample.runId) : null,
    runAttempt: Number(sample.runAttempt) || 1,
    sha: sample.sha ? String(sample.sha) : null,
    outcome: ["success", "failure", "cancelled"].includes(sample.outcome) ? sample.outcome : "failure",
    durationMs: Math.max(0, Number(sample.durationMs) || 0),
    generatedAt: sample.generatedAt || new Date().toISOString(),
    policyRevision: Number(sample.policyRevision) || 0,
    url: sample.url || null
  };
}

export function mergeIosSafariStabilityHistory(previousSamples, nextSamples) {
  const byRun = new Map();
  for (const sample of [...(previousSamples ?? []), ...(nextSamples ?? [])]) {
    const normalized = normalizedSample(sample);
    byRun.set(runIdentity(normalized), normalized);
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
  return {
    sampleCount: samples.length,
    successes,
    failures: samples.length - successes,
    successRate,
    p95DurationMs: percentile(samples.map(({ durationMs }) => durationMs), 0.95),
    maximumConsecutiveFailures: consecutiveFailures(samples),
    runIds: samples.map(({ runId }) => runId).filter(Boolean)
  };
}

function policyIssues(summary) {
  const issues = [];
  if (summary.successRate < iosSafariStabilityPolicy.minimumSuccessRate) {
    issues.push(`성공률 ${Math.round(summary.successRate * 100)}%/${Math.round(iosSafariStabilityPolicy.minimumSuccessRate * 100)}%`);
  }
  if (summary.p95DurationMs > iosSafariStabilityPolicy.maximumP95DurationMs) {
    issues.push(`p95 실행 시간 ${Math.round(summary.p95DurationMs / 1000)}초/${Math.round(iosSafariStabilityPolicy.maximumP95DurationMs / 1000)}초`);
  }
  if (summary.maximumConsecutiveFailures > iosSafariStabilityPolicy.maximumConsecutiveFailures) {
    issues.push(`연속 실패 ${summary.maximumConsecutiveFailures}회/${iosSafariStabilityPolicy.maximumConsecutiveFailures}회`);
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
    ? [`Node 22·URL 재시도 이후 표본 ${acceptance.sampleCount}/${iosSafariStabilityPolicy.requiredHardenedRuns}`]
    : policyIssues(acceptance);
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
  return [
    "## iOS Safari CI 안정성 추세",
    "",
    `- 최근 실행 10회: **${trend.observed.status}** · ${format(trend.observed)}`,
    `- Node 22·URL 재시도 적용 후: **${trend.acceptance.status}** · ${format(trend.acceptance)}`,
    "",
    ...[...trend.observed.issues, ...trend.acceptance.issues].map((issue) => `- ${issue}`),
    ""
  ].join("\n");
}
