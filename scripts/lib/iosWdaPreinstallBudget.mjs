export const iosWdaPreinstallBudgetMs = 40_000;
export const iosWdaPreinstallHardLimitMs = 120_000;

export function auditIosWdaPreinstall({
  durationMs,
  sourceBytes = 0,
  installBytes = 0,
  budgetMs = iosWdaPreinstallBudgetMs,
  hardLimitMs = iosWdaPreinstallHardLimitMs
}) {
  const duration = Number(durationMs);
  const source = Number(sourceBytes);
  const install = Number(installBytes);
  const budget = Number(budgetMs);
  const hardLimit = Number(hardLimitMs);
  if (!Number.isFinite(duration) || duration < 0) throw new Error("WDA 선설치 시간이 유효하지 않습니다.");
  if (!Number.isFinite(source) || source < 0) throw new Error("WDA 원본 크기가 유효하지 않습니다.");
  if (!Number.isFinite(install) || install < 0) throw new Error("WDA 설치 번들 크기가 유효하지 않습니다.");
  if (!Number.isFinite(budget) || budget <= 0) throw new Error("WDA 선설치 예산이 유효하지 않습니다.");
  if (!Number.isFinite(hardLimit) || hardLimit < budget) throw new Error("WDA 선설치 하드 상한이 유효하지 않습니다.");
  const targetMet = duration <= budget;
  return {
    status: targetMet ? "passed" : duration <= hardLimit ? "watch" : "failed",
    targetMet,
    durationMs: duration,
    budgetMs: budget,
    hardLimitMs: hardLimit,
    remainingMs: budget - duration,
    sourceBytes: source,
    installBytes: install,
    savedBytes: Math.max(0, source - install),
    reductionRatio: source > 0 ? Math.max(0, source - install) / source : 0
  };
}
