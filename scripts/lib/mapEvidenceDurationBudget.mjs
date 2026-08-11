export const targetedMapEvidenceBudgetMs = 240_000;
export const targetedMapEvidencePhaseBudgetsMs = Object.freeze({
  setup: 45_000,
  "map-contracts": 65_000,
  "map-diagnostics": 35_000,
  "browser-setup": 45_000,
  "browser-audit-provenance": 65_000,
  "packaging-uploads": 35_000
});

export function auditMapEvidenceDuration({
  startedAtMs,
  setupFinishedAtMs,
  contractsFinishedAtMs,
  diagnosticsFinishedAtMs,
  browserSetupFinishedAtMs,
  auditProvenanceFinishedAtMs,
  finishedAtMs = Date.now(),
  budgetMs = targetedMapEvidenceBudgetMs,
  phaseBudgetsMs = targetedMapEvidencePhaseBudgetsMs
}) {
  const start = Number(startedAtMs);
  const finish = Number(finishedAtMs);
  const budget = Number(budgetMs);
  if (!Number.isFinite(start) || start <= 0) throw new Error("맵 증거 시작 시각이 유효하지 않습니다.");
  if (!Number.isFinite(finish) || finish < start) throw new Error("맵 증거 종료 시각이 유효하지 않습니다.");
  if (!Number.isFinite(budget) || budget <= 0) throw new Error("맵 증거 시간 예산이 유효하지 않습니다.");
  const durationMs = Math.max(0, finish - start);
  const totalReport = {
    status: durationMs <= budget ? "passed" : "failed",
    startedAtMs: start,
    finishedAtMs: finish,
    durationMs,
    budgetMs: budget,
    remainingMs: budget - durationMs
  };
  const boundaryValues = [
    setupFinishedAtMs,
    contractsFinishedAtMs,
    diagnosticsFinishedAtMs,
    browserSetupFinishedAtMs,
    auditProvenanceFinishedAtMs
  ];
  if (boundaryValues.every((value) => value === undefined || value === null)) return totalReport;
  if (!boundaryValues.every((value) => Number.isFinite(Number(value)))) {
    throw new Error("맵 증거 단계 경계 시각이 모두 필요합니다.");
  }
  const boundaries = [start, ...boundaryValues.map(Number), finish];
  if (boundaries.some((value, index) => index > 0 && value < boundaries[index - 1])) {
    throw new Error("맵 증거 단계 경계 순서가 유효하지 않습니다.");
  }
  const phaseNames = Object.keys(targetedMapEvidencePhaseBudgetsMs);
  const phases = phaseNames.map((name, index) => {
    const phaseBudgetMs = Number(phaseBudgetsMs[name]);
    if (!Number.isFinite(phaseBudgetMs) || phaseBudgetMs <= 0) {
      throw new Error(`${name} 맵 증거 단계 예산이 유효하지 않습니다.`);
    }
    const phaseDurationMs = boundaries[index + 1] - boundaries[index];
    return {
      name,
      status: phaseDurationMs <= phaseBudgetMs ? "passed" : "failed",
      durationMs: phaseDurationMs,
      budgetMs: phaseBudgetMs,
      remainingMs: phaseBudgetMs - phaseDurationMs
    };
  });
  const slowestPhase = [...phases].sort((left, right) => right.durationMs - left.durationMs)[0] ?? null;
  const phaseIssues = phases
    .filter(({ status }) => status === "failed")
    .map(({ name, durationMs: phaseDurationMs, budgetMs: phaseBudgetMs }) => (
      `${name} ${Math.round(phaseDurationMs / 1000)}초/${Math.round(phaseBudgetMs / 1000)}초`
    ));
  return {
    ...totalReport,
    status: totalReport.status === "passed" && phaseIssues.length === 0 ? "passed" : "failed",
    phases,
    slowestPhase,
    phaseIssues
  };
}
