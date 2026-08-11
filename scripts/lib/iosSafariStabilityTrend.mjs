export const iosSafariStabilityPolicy = Object.freeze({
  observedWindow: 10,
  requiredHardenedRuns: 10,
  minimumSuccessRate: 0.9,
  maximumP95DurationMs: 20 * 60_000,
  maximumP95SetupDurationMs: 8 * 60_000,
  maximumP95CaptureDurationMs: 12 * 60_000,
  targetP95WdaPreinstallDurationMs: 40_000,
  maximumP95WdaPreinstallDurationMs: 120_000,
  maximumConsecutiveFailures: 1,
  requiredFaultRecoveryStrategies: ["activate-refresh", "recreate-session"],
  retainedRuns: 30,
  policyRevision: 7,
  capturePhaseSchemaVersion: 2
});

function runIdentity(sample) {
  if (sample.runId) return String(sample.runId);
  return `${sample.sha || "unknown"}:${sample.runAttempt || 1}:${sample.generatedAt || "unknown"}`;
}

export function normalizeCapturePhaseDurations(value) {
  let source = value;
  if (typeof value === "string") {
    try {
      source = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source)
    .filter(([name, durationMs]) => /^[a-z0-9-]+$/.test(name) && Number.isFinite(Number(durationMs)))
    .map(([name, durationMs]) => [name, Math.max(0, Number(durationMs))]));
}

function normalizedSample(sample = {}) {
  const capturePhaseDurationsMs = normalizeCapturePhaseDurations(sample.capturePhaseDurationsMs);
  const inferredCapturePhaseSchemaVersion = ["appium-readiness", "wda-session", "safari-navigation"]
    .every((name) => Object.hasOwn(capturePhaseDurationsMs, name)) ? 2
    : Object.hasOwn(capturePhaseDurationsMs, "session-setup") ? 1 : 0;
  return {
    runId: sample.runId ? String(sample.runId) : null,
    runAttempt: Number(sample.runAttempt) || 1,
    sha: sample.sha ? String(sample.sha) : null,
    outcome: ["success", "failure", "cancelled"].includes(sample.outcome) ? sample.outcome : "failure",
    durationMs: Math.max(0, Number(sample.durationMs) || 0),
    queueDurationMs: Math.max(0, Number(sample.queueDurationMs) || 0),
    setupDurationMs: Math.max(0, Number(sample.setupDurationMs) || 0),
    captureDurationMs: Math.max(0, Number(sample.captureDurationMs) || 0),
    capturePhaseDurationsMs,
    capturePhaseSchemaVersion: Number(sample.capturePhaseSchemaVersion) || inferredCapturePhaseSchemaVersion,
    bridgeInstallDurationMs: Math.max(0, Number(sample.bridgeInstallDurationMs) || 0),
    appiumCacheHit: sample.appiumCacheHit === true || sample.appiumCacheHit === "true",
    compositorRecoveryCount: Math.max(0, Number(sample.compositorRecoveryCount) || 0),
    compositorRecoveryDurationMs: Math.max(0, Number(sample.compositorRecoveryDurationMs) || 0),
    compositorFaultInjected: sample.compositorFaultInjected === true || sample.compositorFaultInjected === "true",
    compositorFaultRecovered: sample.compositorFaultRecovered === true || sample.compositorFaultRecovered === "true",
    compositorRecoveryStrategy: ["activate-refresh", "recreate-session"].includes(sample.compositorRecoveryStrategy)
      ? sample.compositorRecoveryStrategy : null,
    failureCategory: ["product", "automation", "infrastructure", "unknown"].includes(sample.failureCategory)
      ? sample.failureCategory : null,
    failureKind: sample.failureKind ? String(sample.failureKind) : null,
    retryAttempted: sample.retryAttempted === true || sample.retryAttempted === "true",
    retryRecovered: sample.retryRecovered === true || sample.retryRecovered === "true",
    retryFailureCategory: ["product", "automation", "infrastructure", "unknown"].includes(sample.retryFailureCategory)
      ? sample.retryFailureCategory : null,
    retryFailureKind: sample.retryFailureKind ? String(sample.retryFailureKind) : null,
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
    } else if (normalized.outcome === "cancelled") {
      byRun.set(identity, {
        ...existing,
        outcome: "cancelled",
        url: normalized.url ?? existing.url
      });
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
  const queueDurations = samples.map(({ queueDurationMs }) => queueDurationMs).filter((value) => value >= 0);
  const bridgeInstallDurations = samples
    .map(({ bridgeInstallDurationMs }) => bridgeInstallDurationMs)
    .filter((value) => value > 0);
  const recoverySamples = samples.filter(({ compositorRecoveryCount }) => compositorRecoveryCount > 0);
  const faultInjectionSamples = samples.filter(({ compositorFaultInjected }) => compositorFaultInjected);
  const failures = samples.filter(({ outcome }) => outcome === "failure");
  const retrySamples = samples.filter(({ retryAttempted }) => retryAttempted);
  const failureCategories = Object.fromEntries(["product", "automation", "infrastructure", "unknown"].map((category) => [
    category,
    failures.filter(({ failureCategory }) => (failureCategory ?? "unknown") === category).length
  ]));
  const failureKinds = Object.fromEntries([...new Set(failures.map(({ failureKind }) => failureKind ?? "unknown"))]
    .sort()
    .map((kind) => [kind, failures.filter(({ failureKind }) => (failureKind ?? "unknown") === kind).length]));
  const retryFailureCategories = Object.fromEntries(["product", "automation", "infrastructure", "unknown"].map((category) => [
    category,
    retrySamples.filter(({ retryFailureCategory }) => (retryFailureCategory ?? "unknown") === category).length
  ]));
  const recoveryStrategies = Object.fromEntries(iosSafariStabilityPolicy.requiredFaultRecoveryStrategies.map((strategy) => {
    const strategySamples = faultInjectionSamples.filter(({ compositorRecoveryStrategy }) => compositorRecoveryStrategy === strategy);
    return [strategy, {
      samples: strategySamples.length,
      successes: strategySamples.filter(({ compositorFaultRecovered }) => compositorFaultRecovered).length
    }];
  }));
  const capturePhaseSamples = samples.filter(({ capturePhaseSchemaVersion }) => (
    capturePhaseSchemaVersion === iosSafariStabilityPolicy.capturePhaseSchemaVersion
  ));
  const capturePhaseNames = [...new Set(capturePhaseSamples.flatMap(({ capturePhaseDurationsMs }) => (
    Object.keys(capturePhaseDurationsMs)
  )))].sort();
  const p95CapturePhaseDurationsMs = Object.fromEntries(capturePhaseNames.map((name) => [
    name,
    percentile(capturePhaseSamples
      .map(({ capturePhaseDurationsMs }) => capturePhaseDurationsMs[name] ?? 0)
      .filter((value) => value > 0), 0.95)
  ]));
  const slowestCapturePhase = Object.entries(p95CapturePhaseDurationsMs)
    .sort((left, right) => right[1] - left[1])[0] ?? null;
  return {
    sampleCount: samples.length,
    successes,
    failures: samples.length - successes,
    failureCategories,
    failureKinds,
    successRate,
    p95DurationMs: percentile(samples.map(({ durationMs }) => durationMs), 0.95),
    p95QueueDurationMs: percentile(queueDurations, 0.95),
    p95SetupDurationMs: percentile(setupDurations, 0.95),
    p95CaptureDurationMs: percentile(captureDurations, 0.95),
    p95CapturePhaseDurationsMs,
    p95WdaPreinstallDurationMs: p95CapturePhaseDurationsMs["wda-preinstall"] ?? 0,
    wdaPreinstallTargetStatus: (p95CapturePhaseDurationsMs["wda-preinstall"] ?? 0)
      <= iosSafariStabilityPolicy.targetP95WdaPreinstallDurationMs ? "passed" : "watch",
    slowestCapturePhase: slowestCapturePhase
      ? { name: slowestCapturePhase[0], p95DurationMs: slowestCapturePhase[1] }
      : null,
    p95BridgeInstallDurationMs: percentile(bridgeInstallDurations, 0.95),
    phaseTimingSamples: capturePhaseSamples.length,
    capturePhaseSchemaVersion: iosSafariStabilityPolicy.capturePhaseSchemaVersion,
    cachedAppiumSamples: samples.filter(({ appiumCacheHit }) => appiumCacheHit).length,
    preinstalledWdaSamples: samples.filter(({ wdaMode }) => wdaMode === "preinstalled").length,
    retryAttempts: retrySamples.length,
    recoveredRetries: retrySamples.filter(({ retryRecovered }) => retryRecovered).length,
    retryFailureCategories,
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

function policyIssues(summary, {
  requireRecoveryStrategies = false,
  recoveryStrategies = summary.recoveryStrategies,
  enforceWdaPreinstallBudget = false
} = {}) {
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
  if (
    enforceWdaPreinstallBudget
    && summary.p95WdaPreinstallDurationMs > iosSafariStabilityPolicy.maximumP95WdaPreinstallDurationMs
  ) {
    issues.push(
      `WDA 선설치 p95 ${Math.round(summary.p95WdaPreinstallDurationMs / 1000)}초`
      + `/${Math.round(iosSafariStabilityPolicy.maximumP95WdaPreinstallDurationMs / 1000)}초`
    );
  }
  if (summary.maximumConsecutiveFailures > iosSafariStabilityPolicy.maximumConsecutiveFailures) {
    issues.push(`연속 실패 ${summary.maximumConsecutiveFailures}회/${iosSafariStabilityPolicy.maximumConsecutiveFailures}회`);
  }
  if (requireRecoveryStrategies) {
    for (const strategy of iosSafariStabilityPolicy.requiredFaultRecoveryStrategies) {
      const coverage = recoveryStrategies[strategy];
      if (!coverage || coverage.samples < 1 || coverage.successes < coverage.samples) {
        issues.push(`${strategy} 합성기 복구 표본 ${coverage?.successes ?? 0}/${coverage?.samples ?? 0}`);
      }
    }
  }
  return issues;
}

export function buildIosSafariStabilityTrend(samples) {
  const ordered = mergeIosSafariStabilityHistory([], samples);
  const completed = ordered.filter(({ outcome }) => outcome !== "cancelled");
  const excludedCancelledRuns = ordered.length - completed.length;
  const observedSamples = completed.slice(-iosSafariStabilityPolicy.observedWindow);
  const hardenedHistory = completed
    .filter(({ policyRevision }) => policyRevision === iosSafariStabilityPolicy.policyRevision);
  const hardenedSamples = hardenedHistory.slice(-iosSafariStabilityPolicy.requiredHardenedRuns);
  const retainedRecoveryStrategies = summarize(hardenedHistory).recoveryStrategies;
  const observed = summarize(observedSamples);
  const observedIssues = observed.sampleCount < iosSafariStabilityPolicy.observedWindow
    ? [`관측 표본 ${observed.sampleCount}/${iosSafariStabilityPolicy.observedWindow}`]
    : policyIssues(observed);
  const acceptance = summarize(hardenedSamples);
  const acceptanceIssues = acceptance.sampleCount < iosSafariStabilityPolicy.requiredHardenedRuns
    ? [`현행 측정 정책 적용 이후 표본 ${acceptance.sampleCount}/${iosSafariStabilityPolicy.requiredHardenedRuns}`]
    : policyIssues(acceptance, {
      requireRecoveryStrategies: true,
      recoveryStrategies: retainedRecoveryStrategies,
      enforceWdaPreinstallBudget: true
    });
  return {
    policy: iosSafariStabilityPolicy,
    excludedCancelledRuns,
    observed: {
      ...observed,
      status: observed.sampleCount < iosSafariStabilityPolicy.observedWindow
        ? "warming" : observedIssues.length === 0 ? "passed" : "watch",
      issues: observedIssues
    },
    acceptance: {
      ...acceptance,
      recoveryStrategies: retainedRecoveryStrategies,
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
    ? ` · 대기 p95 ${Math.round(trend.acceptance.p95QueueDurationMs / 1000)}초`
      + ` · 준비 p95 ${Math.round(trend.acceptance.p95SetupDurationMs / 1000)}초`
      + ` · 캡처 p95 ${Math.round(trend.acceptance.p95CaptureDurationMs / 1000)}초`
      + ` · Appium 준비 p95 ${Math.round(trend.acceptance.p95BridgeInstallDurationMs / 1000)}초`
      + ` · Appium 캐시 ${trend.acceptance.cachedAppiumSamples}/${trend.acceptance.sampleCount}`
      + ` · Prebuilt WDA ${trend.acceptance.preinstalledWdaSamples}/${trend.acceptance.sampleCount}`
      + ` · WDA 선설치 p95 ${Math.round(trend.acceptance.p95WdaPreinstallDurationMs / 1000)}초/40초 목표 ${trend.acceptance.wdaPreinstallTargetStatus}`
      + ` · 단계 v${trend.acceptance.capturePhaseSchemaVersion} ${trend.acceptance.phaseTimingSamples}/${trend.acceptance.sampleCount}`
      + `${trend.acceptance.slowestCapturePhase
        ? ` · 느린 단계 ${trend.acceptance.slowestCapturePhase.name} p95 ${Math.round(trend.acceptance.slowestCapturePhase.p95DurationMs / 1000)}초`
        : ""}`
    : "";
  const compositor = ` · compositor 복구 ${trend.acceptance.recoveryRuns}/${trend.acceptance.sampleCount}`
    + ` · 복구 p95 ${Math.round(trend.acceptance.p95RecoveryDurationMs / 1000)}초`
    + ` · 주입 복구 ${trend.acceptance.successfulFaultRecoveries}/${trend.acceptance.faultInjectionSamples}`
    + ` · activate ${trend.acceptance.recoveryStrategies["activate-refresh"].successes}/${trend.acceptance.recoveryStrategies["activate-refresh"].samples}`
    + ` · recreate ${trend.acceptance.recoveryStrategies["recreate-session"].successes}/${trend.acceptance.recoveryStrategies["recreate-session"].samples}`;
  const failures = ` · 실패 분류 제품 ${trend.acceptance.failureCategories.product}`
    + `/자동화 ${trend.acceptance.failureCategories.automation}`
    + `/인프라 ${trend.acceptance.failureCategories.infrastructure}`
    + `/미분류 ${trend.acceptance.failureCategories.unknown}`;
  const retries = ` · 선택 재시도 ${trend.acceptance.recoveredRetries}/${trend.acceptance.retryAttempts} 복구`
    + ` · 원인 자동화 ${trend.acceptance.retryFailureCategories.automation}`
    + `/인프라 ${trend.acceptance.retryFailureCategories.infrastructure}`;
  return [
    "## iOS Safari CI 안정성 추세",
    "",
    `- 최근 완료 실행 10회: **${trend.observed.status}** · ${format(trend.observed)}`
      + `${trend.excludedCancelledRuns > 0 ? ` · 취소 제외 ${trend.excludedCancelledRuns}회` : ""}`,
    `- 현행 측정 정책 적용 후: **${trend.acceptance.status}** · ${format(trend.acceptance)}${phase}${compositor}${failures}${retries}`,
    "",
    ...[...trend.observed.issues, ...trend.acceptance.issues].map((issue) => `- ${issue}`),
    ""
  ].join("\n");
}
