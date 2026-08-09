import { defaultVisualDiffClassificationPolicy } from "./visualDiffClassifier.mjs";

export const visualDiffCalibrationMinimumSamples = 5;
export const visualDiffCalibrationEngines = Object.freeze(["chromium", "webkit"]);

const finite = (value) => Number.isFinite(value) && value >= 0 ? value : null;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

export function visualDiffEngine(detail = {}) {
  if (visualDiffCalibrationEngines.includes(detail.engine)) return detail.engine;
  if (detail.source === "ios") return "webkit";
  if (detail.source === "android") return "chromium";
  if (String(detail.source ?? "").startsWith("hud/")) {
    return String(detail.source).includes("webkit") ? "webkit" : "chromium";
  }
  return null;
}

function snapshotFromSummary(summary) {
  if (!summary?.sha) return null;
  const engines = {};
  for (const detail of summary.visualDifferences?.details ?? []) {
    const engine = visualDiffEngine(detail);
    if (!engine) continue;
    const classification = detail.classification ?? {};
    const filteredNoiseShare = finite(classification.filteredNoiseShare);
    const budgetUsage = finite(classification.budgetUsage);
    if (filteredNoiseShare === null || budgetUsage === null) continue;
    const entry = engines[engine] ??= { filteredNoiseShares: [], budgetUsages: [] };
    entry.filteredNoiseShares.push(filteredNoiseShare);
    entry.budgetUsages.push(budgetUsage);
  }
  return Object.keys(engines).length === 0 ? null : {
    sha: summary.sha,
    generatedAt: summary.generatedAt ?? new Date().toISOString(),
    engines
  };
}

export function seedVisualDiffCalibrationHistory(history = {}, summaries = []) {
  const snapshots = new Map((history.snapshots ?? []).filter(({ sha }) => sha).map((snapshot) => [snapshot.sha, snapshot]));
  for (const summary of summaries) {
    const snapshot = snapshotFromSummary(summary);
    if (snapshot) snapshots.set(snapshot.sha, snapshot);
  }
  return {
    version: 1,
    snapshots: [...snapshots.values()]
      .sort((left, right) => String(left.generatedAt).localeCompare(String(right.generatedAt)))
      .slice(-20)
  };
}

export function buildVisualDiffCalibration(summary, history = {}) {
  const seededHistory = seedVisualDiffCalibrationHistory(history, [summary]);
  const engines = {};
  const policies = {};
  for (const engine of visualDiffCalibrationEngines) {
    const samples = seededHistory.snapshots.filter((snapshot) => snapshot.engines?.[engine]);
    const filteredNoiseShares = samples.flatMap((snapshot) => snapshot.engines[engine].filteredNoiseShares ?? []);
    const budgetUsages = samples.flatMap((snapshot) => snapshot.engines[engine].budgetUsages ?? []);
    const defaultPolicy = { ...defaultVisualDiffClassificationPolicy };
    const active = samples.length >= visualDiffCalibrationMinimumSamples
      && filteredNoiseShares.length >= visualDiffCalibrationMinimumSamples;
    const policy = active ? {
      rendererNoiseMinimumShare: clamp((percentile(filteredNoiseShares, 0.2) ?? 0.6) - 0.05, 0.5, 0.7),
      rendererNoiseMaximumBudgetUsage: clamp((percentile(budgetUsages, 0.9) ?? 0.3) + 0.05, 0.3, 0.6),
      watchStructuralMinimumBudgetUsage: clamp((percentile(budgetUsages, 0.95) ?? 0.55) + 0.1, 0.6, 0.8)
    } : defaultPolicy;
    policies[engine] = policy;
    engines[engine] = {
      status: active ? "active" : "warming",
      sampleCount: samples.length,
      requiredSamples: visualDiffCalibrationMinimumSamples,
      observationCount: filteredNoiseShares.length,
      policy
    };
  }
  return {
    history: seededHistory,
    calibration: {
      version: 1,
      status: Object.values(engines).every(({ status }) => status === "active") ? "active" : "warming",
      engines
    },
    policies
  };
}
