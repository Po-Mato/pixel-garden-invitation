export const targetedMapEvidenceBudgetMs = 240_000;

export function auditMapEvidenceDuration({ startedAtMs, finishedAtMs = Date.now(), budgetMs = targetedMapEvidenceBudgetMs }) {
  const start = Number(startedAtMs);
  const finish = Number(finishedAtMs);
  const budget = Number(budgetMs);
  if (!Number.isFinite(start) || start <= 0) throw new Error("맵 증거 시작 시각이 유효하지 않습니다.");
  if (!Number.isFinite(finish) || finish < start) throw new Error("맵 증거 종료 시각이 유효하지 않습니다.");
  if (!Number.isFinite(budget) || budget <= 0) throw new Error("맵 증거 시간 예산이 유효하지 않습니다.");
  const durationMs = Math.max(0, finish - start);
  return {
    status: durationMs <= budget ? "passed" : "failed",
    startedAtMs: start,
    finishedAtMs: finish,
    durationMs,
    budgetMs: budget,
    remainingMs: budget - durationMs
  };
}
