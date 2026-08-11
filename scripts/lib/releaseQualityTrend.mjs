const metricPolicies = Object.freeze([
  { category: "map", key: "changedRatio", direction: "lower", absoluteTolerance: 0.002, relativeTolerance: 0.25 },
  { category: "ios", key: "p95FrameMs", direction: "lower", absoluteTolerance: 3, relativeTolerance: 0.15 },
  { category: "pwa", key: "largestContentfulPaintMs", direction: "lower", absoluteTolerance: 250, relativeTolerance: 0.15 },
  { category: "visual", key: "structural-regression", direction: "lower", absoluteTolerance: 0, relativeTolerance: 0 }
]);

export const repeatedWatchStructuralReleaseThreshold = 3;
export const devicePwaTransportTrendPolicy = Object.freeze({
  observedWindow: 10,
  requiredSamplesPerPlatform: 3,
  platforms: Object.freeze({
    android: Object.freeze({ engine: "Chromium", maximumP95LatencyMs: 750 }),
    ios: Object.freeze({ engine: "WebKit", maximumP95LatencyMs: 1_000 })
  })
});
export const androidCaptureRetryTrendPolicy = Object.freeze({
  observedWindow: 10,
  requiredSamples: 3,
  maximumRetryRate: 0.25,
  minimumRetryAttemptsForAlert: 2
});

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * ratio) - 1)];
}

export function buildDevicePwaTransportTrend(snapshots = []) {
  const platforms = Object.fromEntries(["android", "ios"].map((platform) => {
    const platformPolicy = devicePwaTransportTrendPolicy.platforms[platform];
    const samples = snapshots
      .filter(({ sha }, index, values) => sha && values.findLastIndex((candidate) => candidate.sha === sha) === index)
      .map((snapshot) => ({
        sha: snapshot.sha,
        generatedAt: snapshot.generatedAt,
        blocked: snapshot.categories?.[platform]?.metrics?.transportBlocked,
        latencyMs: snapshot.categories?.[platform]?.metrics?.transportBlockLatencyMs,
        errorKind: snapshot.categories?.[platform]?.metrics?.transportErrorKind
      }))
      .filter(({ blocked, latencyMs, errorKind }) => (
        typeof blocked === "boolean" && Number.isFinite(latencyMs) && typeof errorKind === "string"
      ))
      .slice(-devicePwaTransportTrendPolicy.observedWindow);
    const blockedSamples = samples.filter(({ blocked }) => blocked).length;
    const p95LatencyMs = percentile(samples.map(({ latencyMs }) => latencyMs), 0.95);
    const errorKinds = Object.fromEntries([...new Set(samples.map(({ errorKind }) => errorKind))]
      .sort()
      .map((kind) => [kind, samples.filter(({ errorKind }) => errorKind === kind).length]));
    const alertActive = samples.length >= devicePwaTransportTrendPolicy.requiredSamplesPerPlatform;
    const p95Exceeded = alertActive && p95LatencyMs > platformPolicy.maximumP95LatencyMs;
    const issues = [];
    if (alertActive) {
      if (blockedSamples !== samples.length) issues.push(`차단 ${blockedSamples}/${samples.length}`);
      if (p95Exceeded) {
        issues.push(`p95 ${Math.round(p95LatencyMs)}ms/${platformPolicy.maximumP95LatencyMs}ms`);
      }
    }
    return [platform, {
      engine: platformPolicy.engine,
      status: !alertActive
        ? "warming" : issues.length > 0 ? "watch" : "passed",
      sampleCount: samples.length,
      blockedSamples,
      blockRate: samples.length === 0 ? 0 : blockedSamples / samples.length,
      p95LatencyMs,
      errorKinds,
      alert: {
        active: alertActive,
        triggered: p95Exceeded,
        status: !alertActive ? "warming" : p95Exceeded ? "triggered" : "armed",
        engine: platformPolicy.engine,
        maximumP95LatencyMs: platformPolicy.maximumP95LatencyMs,
        observedP95LatencyMs: p95LatencyMs
      },
      issues,
      samples
    }];
  }));
  const values = Object.values(platforms);
  return {
    policy: devicePwaTransportTrendPolicy,
    status: values.some(({ status }) => status === "watch")
      ? "watch" : values.some(({ status }) => status === "warming") ? "warming" : "passed",
    platforms,
    monitors: Object.entries(platforms)
      .filter(([, value]) => value.alert.active)
      .map(([platform, value]) => ({ platform, ...value.alert })),
    activeAlerts: Object.entries(platforms)
      .filter(([, value]) => value.alert.triggered)
      .map(([platform, value]) => ({ platform, ...value.alert })),
    triggeredAlerts: Object.entries(platforms)
      .filter(([, value]) => value.alert.triggered)
      .map(([platform, value]) => ({ platform, ...value.alert })),
    issues: Object.entries(platforms).flatMap(([platform, value]) => value.issues.map((issue) => `${platform}: ${issue}`))
  };
}

export function buildAndroidCaptureRetryTrend(snapshots = []) {
  const samples = snapshots
    .filter(({ sha }, index, values) => sha && values.findLastIndex((candidate) => candidate.sha === sha) === index)
    .map((snapshot) => {
      const android = snapshot.categories?.android;
      const attempted = android?.metrics?.captureRetryAttempted;
      if (typeof attempted !== "boolean") return null;
      return {
        sha: snapshot.sha,
        generatedAt: snapshot.generatedAt,
        attempted,
        recovered: attempted && android.status === "passed",
        reason: attempted ? android.metrics?.captureRetryReason ?? "unknown" : null
      };
    })
    .filter(Boolean)
    .slice(-androidCaptureRetryTrendPolicy.observedWindow);
  const retrySamples = samples.filter(({ attempted }) => attempted);
  const retryAttempts = retrySamples.length;
  const recoveredRetries = retrySamples.filter(({ recovered }) => recovered).length;
  const retryRate = samples.length === 0 ? 0 : retryAttempts / samples.length;
  const active = samples.length >= androidCaptureRetryTrendPolicy.requiredSamples;
  const triggered = active
    && retryAttempts >= androidCaptureRetryTrendPolicy.minimumRetryAttemptsForAlert
    && retryRate > androidCaptureRetryTrendPolicy.maximumRetryRate;
  const reasons = Object.fromEntries([...new Set(retrySamples.map(({ reason }) => reason))]
    .sort()
    .map((reason) => [reason, retrySamples.filter((sample) => sample.reason === reason).length]));
  return {
    status: !active ? "warming" : triggered ? "watch" : "passed",
    sampleCount: samples.length,
    retryAttempts,
    recoveredRetries,
    retryRate,
    recoveryRate: retryAttempts === 0 ? 1 : recoveredRetries / retryAttempts,
    reasons,
    alert: {
      active,
      triggered,
      status: !active ? "warming" : triggered ? "triggered" : "armed",
      maximumRetryRate: androidCaptureRetryTrendPolicy.maximumRetryRate,
      minimumRetryAttempts: androidCaptureRetryTrendPolicy.minimumRetryAttemptsForAlert
    },
    samples
  };
}

function watchStructuralKey(detail) {
  return `${String(detail.source ?? "unknown")}::${String(detail.state ?? "unknown")}`;
}

function watchStructuralKeys(summary) {
  return [...new Set((summary.visualDifferences?.details ?? [])
    .filter(({ classification }) => classification?.id === "watch-structural")
    .map(watchStructuralKey))].sort();
}

function repeatedWatchStructuralTrend(summary, previousSnapshots) {
  const currentKeys = watchStructuralKeys(summary);
  const previousDistinct = previousSnapshots.filter(({ sha }) => sha && sha !== summary.sha);
  const candidates = currentKeys.map((key) => {
    let consecutiveReleases = 1;
    const releaseShas = [summary.sha].filter(Boolean);
    for (const snapshot of [...previousDistinct].reverse()) {
      if (!(snapshot.visualDifferences?.watchStructuralKeys ?? []).includes(key)) break;
      consecutiveReleases += 1;
      releaseShas.unshift(snapshot.sha);
    }
    const [source, state] = key.split("::");
    return {
      key,
      source,
      state,
      consecutiveReleases,
      requiredReleases: repeatedWatchStructuralReleaseThreshold,
      releaseShas,
      promoted: consecutiveReleases >= repeatedWatchStructuralReleaseThreshold
    };
  });
  const promoted = candidates.filter(({ promoted }) => promoted);
  return {
    status: promoted.length > 0 ? "review-required" : candidates.length > 0 ? "observing" : "clear",
    requiredReleases: repeatedWatchStructuralReleaseThreshold,
    candidates,
    promoted
  };
}

function metricValue(summary, category, key) {
  if (category === "visual") return summary.visualDifferences?.counts?.[key] ?? 0;
  return summary.categories?.find(({ id }) => id === category)?.metrics?.[key] ?? null;
}

export function releaseQualitySnapshot(summary) {
  return {
    sha: summary.sha ?? null,
    generatedAt: summary.generatedAt ?? new Date().toISOString(),
    status: summary.status,
    categories: Object.fromEntries((summary.categories ?? []).map(({ id, status, metrics }) => [id, { status, metrics }])),
    visualDifferences: summary.visualDifferences ? {
      status: summary.visualDifferences.status,
      counts: summary.visualDifferences.counts,
      watchStructuralKeys: watchStructuralKeys(summary)
    } : null
  };
}

export function seedReleaseQualityHistory(history = { version: 1, snapshots: [] }, summaries = [], { limit = 20 } = {}) {
  const candidates = [
    ...(Array.isArray(history?.snapshots) ? history.snapshots : []),
    ...summaries.filter(Boolean).map(releaseQualitySnapshot)
  ].filter(({ sha }) => sha);
  const bySha = new Map();
  for (const snapshot of candidates.sort((left, right) => String(left.generatedAt).localeCompare(String(right.generatedAt)))) {
    bySha.set(snapshot.sha, snapshot);
  }
  return { version: 1, snapshots: [...bySha.values()].slice(-limit) };
}

export function buildReleaseQualityTrend(summary, history = { version: 1, snapshots: [] }, { limit = 20 } = {}) {
  const current = releaseQualitySnapshot(summary);
  const previousSnapshots = Array.isArray(history?.snapshots) ? history.snapshots : [];
  const previous = [...previousSnapshots].reverse().find(({ sha }) => sha && sha !== current.sha) ?? null;
  const comparisons = metricPolicies.map((policy) => {
    const currentValue = metricValue(summary, policy.category, policy.key);
    const previousValue = previous
      ? policy.category === "visual"
        ? previous.visualDifferences?.counts?.[policy.key] ?? 0
        : previous.categories?.[policy.category]?.metrics?.[policy.key] ?? null
      : null;
    if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
      return { ...policy, current: currentValue, previous: previousValue, delta: null, regression: false };
    }
    const delta = currentValue - previousValue;
    const relativeDelta = previousValue === 0 ? (delta > 0 ? Infinity : 0) : delta / Math.abs(previousValue);
    const regression = policy.direction === "lower"
      ? delta > policy.absoluteTolerance && relativeDelta > policy.relativeTolerance
      : delta < -policy.absoluteTolerance && relativeDelta < -policy.relativeTolerance;
    return { ...policy, current: currentValue, previous: previousValue, delta, relativeDelta, regression };
  });
  const categoryRegressions = previous ? (summary.categories ?? []).flatMap((category) => {
    const previousStatus = previous.categories?.[category.id]?.status;
    return previousStatus === "passed" && category.status !== "passed"
      ? [`${category.id}: ${previousStatus} -> ${category.status}`]
      : [];
  }) : [];
  const regressions = [
    ...comparisons.filter(({ regression }) => regression).map(({ category, key, previous: before, current: after }) => (
      `${category}.${key}: ${before} -> ${after}`
    )),
    ...categoryRegressions
  ];
  const watchStructural = repeatedWatchStructuralTrend(summary, previousSnapshots);
  const withoutCurrent = previousSnapshots.filter(({ sha }) => !current.sha || sha !== current.sha);
  const snapshots = [...withoutCurrent, current].slice(-limit);
  const devicePwaTransport = buildDevicePwaTransportTrend(snapshots);
  const androidCaptureRetry = buildAndroidCaptureRetryTrend(snapshots);
  return {
    history: { version: 1, snapshots },
    trend: {
      status: previous === null
        ? "warming"
        : regressions.length > 0
          || watchStructural.status === "review-required"
          || devicePwaTransport.status === "watch"
          || androidCaptureRetry.status === "watch" ? "watch" : "stable",
      previousSha: previous?.sha ?? null,
      sampleCount: snapshots.length,
      comparisons,
      regressions,
      watchStructural,
      devicePwaTransport,
      androidCaptureRetry
    }
  };
}
