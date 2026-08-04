const dayMs = 24 * 60 * 60 * 1000;

function validDate(value, label) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} 날짜가 올바르지 않습니다`);
  return date;
}

function positiveDays(value, fallback, label) {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved < 0) throw new Error(`${label}은 0 이상의 숫자여야 합니다`);
  return resolved;
}

function zoneRules(config, zoneId) {
  const override = config?.zones?.[zoneId] ?? {};
  const owner = override.owner ?? config?.defaultOwner;
  if (typeof owner !== "string" || owner.trim() === "") throw new Error(`${zoneId} 정책 담당자가 없습니다`);
  const reviewAfterDays = positiveDays(override.reviewAfterDays, config?.reviewAfterDays, "reviewAfterDays");
  const expireAfterDays = positiveDays(override.expireAfterDays, config?.expireAfterDays, "expireAfterDays");
  if (expireAfterDays < reviewAfterDays) throw new Error(`${zoneId} expireAfterDays는 reviewAfterDays 이상이어야 합니다`);
  return { owner, reviewAfterDays, expireAfterDays };
}

function statusAt(now, dueAt, expiresAt, dueSoonDays) {
  if (now >= expiresAt) return "expired";
  if (now >= dueAt) return "overdue";
  if (dueAt.getTime() - now.getTime() <= dueSoonDays * dayMs) return "due-soon";
  return "active";
}

export function buildWorldGeometryPolicyGovernance(
  tuningReport,
  previousState = { version: 1, items: [] },
  config,
  { generatedAt = new Date().toISOString() } = {}
) {
  if (config?.version !== 1) throw new Error("정책 담당자 설정 version 1이 필요합니다");
  const now = validDate(generatedAt, "generatedAt");
  const dueSoonDays = positiveDays(config.dueSoonDays, 2, "dueSoonDays");
  const previousItems = new Map((previousState?.items ?? []).map((item) => [`${item.zoneId}:${item.action}`, item]));
  const recommendations = Array.isArray(tuningReport?.recommendations) ? tuningReport.recommendations : [];
  const items = recommendations.filter(({ action }) => action !== "keep").map((recommendation) => {
    const previous = previousItems.get(`${recommendation.zoneId}:${recommendation.action}`);
    const firstObservedAt = previous?.firstObservedAt ?? generatedAt;
    const firstObserved = validDate(firstObservedAt, `${recommendation.zoneId} firstObservedAt`);
    const rules = zoneRules(config, recommendation.zoneId);
    const dueAt = new Date(firstObserved.getTime() + rules.reviewAfterDays * dayMs);
    const expiresAt = new Date(firstObserved.getTime() + rules.expireAfterDays * dayMs);
    return {
      zoneId: recommendation.zoneId,
      action: recommendation.action,
      owner: rules.owner,
      firstObservedAt,
      lastSeenAt: generatedAt,
      dueAt: dueAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: statusAt(now, dueAt, expiresAt, dueSoonDays),
      currentMaxWarnings: recommendation.currentMaxWarnings,
      recommendedMaxWarnings: recommendation.recommendedMaxWarnings
    };
  });
  const count = (status) => items.filter((item) => item.status === status).length;
  return {
    state: { version: 1, items },
    report: {
      version: 1,
      generatedAt,
      status: count("expired") > 0 ? "expired" : count("overdue") > 0 ? "overdue" : items.length > 0 ? "tracking" : "clear",
      reviewCount: items.length,
      dueSoonCount: count("due-soon"),
      overdueCount: count("overdue"),
      expiredCount: count("expired"),
      items
    }
  };
}
