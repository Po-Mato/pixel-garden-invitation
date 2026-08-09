const metricPolicies = Object.freeze([
  { category: "map", key: "changedRatio", direction: "lower", absoluteTolerance: 0.002, relativeTolerance: 0.25 },
  { category: "ios", key: "p95FrameMs", direction: "lower", absoluteTolerance: 3, relativeTolerance: 0.15 },
  { category: "pwa", key: "largestContentfulPaintMs", direction: "lower", absoluteTolerance: 250, relativeTolerance: 0.15 },
  { category: "visual", key: "structural-regression", direction: "lower", absoluteTolerance: 0, relativeTolerance: 0 }
]);

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
    visualDifferences: summary.visualDifferences ? { status: summary.visualDifferences.status, counts: summary.visualDifferences.counts } : null
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
  const withoutCurrent = previousSnapshots.filter(({ sha }) => !current.sha || sha !== current.sha);
  const snapshots = [...withoutCurrent, current].slice(-limit);
  return {
    history: { version: 1, snapshots },
    trend: {
      status: previous === null ? "warming" : regressions.length > 0 ? "watch" : "stable",
      previousSha: previous?.sha ?? null,
      sampleCount: snapshots.length,
      comparisons,
      regressions
    }
  };
}
