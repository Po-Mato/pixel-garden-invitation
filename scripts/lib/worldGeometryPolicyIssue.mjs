import { createHash } from "node:crypto";

export const worldGeometryPolicyIssueMarker = "<!-- world-geometry-policy-expiry -->";

function issueFingerprint(items) {
  const identity = items.map(({ zoneId, action, owner, firstObservedAt, expiresAt, currentMaxWarnings, recommendedMaxWarnings }) => ({
    zoneId, action, owner, firstObservedAt, expiresAt, currentMaxWarnings, recommendedMaxWarnings
  })).sort((left, right) => `${left.zoneId}:${left.action}`.localeCompare(`${right.zoneId}:${right.action}`));
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export function buildWorldGeometryPolicyIssue(governance, {
  runUrl = "",
  label = "world-geometry-policy",
  generatedAt = governance?.generatedAt ?? new Date().toISOString()
} = {}) {
  if (governance?.version !== 1 || !Array.isArray(governance.items)) throw new Error("정책 거버넌스 보고서 version 1이 필요합니다");
  const generatedTime = new Date(generatedAt).getTime();
  if (!Number.isFinite(generatedTime)) throw new Error("정책 이슈 생성 시각이 올바르지 않습니다");
  const expired = governance.items.filter(({ status, expiresAt }) => (
    status === "expired" || new Date(expiresAt).getTime() <= generatedTime
  ));
  const fingerprint = issueFingerprint(expired);
  const rows = expired.map((item) => (
    `| \`${item.zoneId}\` | ${item.owner} | \`${item.action}\` | ${item.dueAt} | ${item.expiresAt} | ${item.currentMaxWarnings} → ${item.recommendedMaxWarnings} |`
  ));
  const body = [
    worldGeometryPolicyIssueMarker,
    "## 만료된 월드 지오메트리 정책 권고",
    "",
    expired.length > 0
      ? `검토 기한이 끝난 권고가 **${expired.length}개** 있습니다. 자동 변경하지 말고 담당자가 근거를 확인한 뒤 승인하거나 기각해야 합니다.`
      : "현재 만료된 정책 권고가 없습니다. 이 이슈는 자동으로 종료할 수 있습니다.",
    "",
    ...(expired.length > 0 ? [
      "| 구역 | 담당자 | 권고 | 검토 기한 | 만료 | 현재 → 권고 |",
      "|---|---|---|---|---|---|",
      ...rows,
      ""
    ] : []),
    runUrl ? `[최신 시각 진단 워크플로](${runUrl})` : "",
    "",
    `상태 지문: \`${fingerprint}\``,
    `생성 시각: ${generatedAt}`,
    "",
    "> 이 이슈는 CI가 관리합니다. 만료 권고가 모두 해소되면 자동으로 닫힙니다."
  ].filter((line, index, values) => line !== "" || values[index - 1] !== "").join("\n");
  return {
    version: 1,
    generatedAt,
    action: expired.length > 0 ? "open-or-update" : "close",
    expiredCount: expired.length,
    fingerprint,
    issue: {
      title: expired.length > 0 ? `[Map policy] 만료 권고 ${expired.length}개 검토 필요` : "[Map policy] 만료 권고 해소",
      label,
      body: `${body.trim()}\n`
    }
  };
}
