export const iosWdaPreinstallBudgetMs = 40_000;

export function auditIosWdaPreinstall({
  durationMs,
  sourceBytes = 0,
  installBytes = 0,
  budgetMs = iosWdaPreinstallBudgetMs
}) {
  const duration = Number(durationMs);
  const source = Number(sourceBytes);
  const install = Number(installBytes);
  const budget = Number(budgetMs);
  if (!Number.isFinite(duration) || duration < 0) throw new Error("WDA 선설치 시간이 유효하지 않습니다.");
  if (!Number.isFinite(source) || source < 0) throw new Error("WDA 원본 크기가 유효하지 않습니다.");
  if (!Number.isFinite(install) || install < 0) throw new Error("WDA 설치 번들 크기가 유효하지 않습니다.");
  if (!Number.isFinite(budget) || budget <= 0) throw new Error("WDA 선설치 예산이 유효하지 않습니다.");
  return {
    status: duration <= budget ? "passed" : "failed",
    durationMs: duration,
    budgetMs: budget,
    remainingMs: budget - duration,
    sourceBytes: source,
    installBytes: install,
    savedBytes: Math.max(0, source - install),
    reductionRatio: source > 0 ? Math.max(0, source - install) / source : 0
  };
}
