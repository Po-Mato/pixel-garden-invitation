const finiteRatio = (value, fallback = 0) => Number.isFinite(value) && value >= 0 ? value : fallback;

export const visualDiffClassifications = Object.freeze({
  stable: "stable",
  rendererNoise: "renderer-noise",
  watchStructural: "watch-structural",
  structuralRegression: "structural-regression",
  intentionalBaselineUpdate: "intentional-baseline-update"
});

export const defaultVisualDiffClassificationPolicy = Object.freeze({
  rendererNoiseMinimumShare: 0.55,
  rendererNoiseMaximumBudgetUsage: 0.35,
  watchStructuralMinimumBudgetUsage: 0.65
});

function classificationPolicy(policy = {}) {
  return {
    rendererNoiseMinimumShare: finiteRatio(
      policy.rendererNoiseMinimumShare,
      defaultVisualDiffClassificationPolicy.rendererNoiseMinimumShare
    ),
    rendererNoiseMaximumBudgetUsage: finiteRatio(
      policy.rendererNoiseMaximumBudgetUsage,
      defaultVisualDiffClassificationPolicy.rendererNoiseMaximumBudgetUsage
    ),
    watchStructuralMinimumBudgetUsage: finiteRatio(
      policy.watchStructuralMinimumBudgetUsage,
      defaultVisualDiffClassificationPolicy.watchStructuralMinimumBudgetUsage
    )
  };
}

export function classifyVisualDifference(comparison = {}, approval = null, policy = null) {
  const changedRatio = finiteRatio(comparison.changedRatio);
  const maxChangedRatio = Math.max(finiteRatio(comparison.maxChangedRatio, 0.015), Number.EPSILON);
  const rawChangedRatio = Number.isFinite(comparison.rawChangedRatio)
    ? finiteRatio(comparison.rawChangedRatio)
    : null;
  const filteredNoiseRatio = rawChangedRatio === null ? null : Math.max(0, rawChangedRatio - changedRatio);
  const filteredNoiseShare = rawChangedRatio > 0 ? filteredNoiseRatio / rawChangedRatio : 0;
  const budgetUsage = changedRatio / maxChangedRatio;
  const thresholds = classificationPolicy(policy ?? {});

  if (approval?.approved === true && typeof approval.reason === "string" && approval.reason.trim()) {
    return {
      id: visualDiffClassifications.intentionalBaselineUpdate,
      confidence: "high",
      likelyCause: "explicit-baseline-approval",
      review: "approved",
      approvalReason: approval.reason.trim(),
      changedRatio,
      rawChangedRatio,
      filteredNoiseRatio,
      filteredNoiseShare,
      budgetUsage
    };
  }

  if (comparison.passed === false || changedRatio > maxChangedRatio) {
    return {
      id: visualDiffClassifications.structuralRegression,
      confidence: "high",
      likelyCause: "layout-or-content-change",
      review: "required",
      changedRatio,
      rawChangedRatio,
      filteredNoiseRatio,
      filteredNoiseShare,
      budgetUsage
    };
  }

  if (
    rawChangedRatio !== null
    && filteredNoiseRatio >= 0.0005
    && filteredNoiseShare >= thresholds.rendererNoiseMinimumShare
    && budgetUsage <= thresholds.rendererNoiseMaximumBudgetUsage
  ) {
    return {
      id: visualDiffClassifications.rendererNoise,
      confidence: filteredNoiseShare >= 0.75 ? "high" : "medium",
      likelyCause: "font-or-antialias-rendering",
      review: "not-required",
      changedRatio,
      rawChangedRatio,
      filteredNoiseRatio,
      filteredNoiseShare,
      budgetUsage
    };
  }

  if (budgetUsage >= thresholds.watchStructuralMinimumBudgetUsage) {
    return {
      id: visualDiffClassifications.watchStructural,
      confidence: "medium",
      likelyCause: "meaningful-change-within-budget",
      review: "recommended",
      changedRatio,
      rawChangedRatio,
      filteredNoiseRatio,
      filteredNoiseShare,
      budgetUsage
    };
  }

  return {
    id: visualDiffClassifications.stable,
    confidence: "high",
    likelyCause: changedRatio === 0 ? "no-change" : "minor-change-within-budget",
    review: "not-required",
    changedRatio,
    rawChangedRatio,
    filteredNoiseRatio,
    filteredNoiseShare,
    budgetUsage
  };
}

export function summarizeVisualDifferenceClassifications(comparisons = []) {
  const details = comparisons.map((comparison) => ({
    source: comparison.source ?? "unknown",
    engine: comparison.engine ?? "unknown",
    state: comparison.state ?? "unknown",
    classification: comparison.classification ?? classifyVisualDifference(comparison)
  }));
  const counts = Object.fromEntries(Object.values(visualDiffClassifications).map((id) => [id, 0]));
  for (const detail of details) {
    if (!(detail.classification.id in counts)) counts[detail.classification.id] = 0;
    counts[detail.classification.id] += 1;
  }
  return {
    status: counts[visualDiffClassifications.structuralRegression] > 0
      ? "failed"
      : counts[visualDiffClassifications.watchStructural] > 0 ? "watch" : "passed",
    counts,
    details
  };
}
