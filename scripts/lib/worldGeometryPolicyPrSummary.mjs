export const worldGeometryPolicySummaryMarker = "<!-- world-geometry-policy-review -->";

function artifactLink(runUrl, label) {
  return runUrl ? `[${label}](${runUrl}#artifacts)` : label;
}

export function buildWorldGeometryPolicyPrSummary(report, {
  approved = false,
  approvalLabel = "geometry-policy-approved",
  runUrl = "",
  governance = null
} = {}) {
  const recommendations = Array.isArray(report?.recommendations) ? report.recommendations : [];
  const reviewItems = recommendations.filter(({ action }) => action !== "keep");
  const approvalStatus = reviewItems.length === 0 ? "not-required" : approved ? "approved" : "awaiting-approval";
  const governanceByZone = new Map((governance?.items ?? []).map((item) => [item.zoneId, item]));
  const lines = [
    worldGeometryPolicySummaryMarker,
    "## 월드 지오메트리 정책 추세",
    "",
    `CI 스냅샷 **${report?.snapshotCount ?? 0}개** · 검토 필요 구역 **${reviewItems.length}개** · 상태 **${approvalStatus}**`,
    ""
  ];
  if (reviewItems.length > 0) {
    lines.push(
      "| 구역 | 판정 | 담당자 | 검토 시계 | 현재→추천 | P90 | 경고 실행 | 차단 실행 |",
      "| --- | --- | --- | --- | ---: | ---: | ---: | ---: |",
      ...reviewItems.map((item) => {
        const tracking = governanceByZone.get(item.zoneId);
        const clock = tracking
          ? `${tracking.status} · ${tracking.dueAt.slice(0, 10)} / ${tracking.expiresAt.slice(0, 10)}`
          : "미추적";
        return `| \`${item.zoneId}\` | \`${item.action}\` | ${tracking?.owner ?? "미지정"} | \`${clock}\` | ${item.currentMaxWarnings}→${item.recommendedMaxWarnings} | ${item.p90Warnings} | ${Math.round(item.warningRunRate * 100)}% | ${item.blockingRuns} |`;
      }),
      ""
    );
    if ((governance?.expiredCount ?? 0) > 0 || (governance?.overdueCount ?? 0) > 0) {
      lines.push(
        `⚠️ 검토 만료 **${governance.expiredCount ?? 0}개** · 기한 초과 **${governance.overdueCount ?? 0}개**입니다. 담당자가 증거를 우선 확인해야 합니다.`,
        ""
      );
    }
    if (approved) {
      lines.push(`✅ PR 라벨 \`${approvalLabel}\`로 수동 검토 승인이 기록되었습니다.`, "");
    } else {
      lines.push(
        "> [!IMPORTANT]",
        `> 정책 파일은 자동 수정되지 않습니다. 증거를 검토한 뒤 PR 라벨 \`${approvalLabel}\`을 추가해야 승인 상태로 바뀝니다.`,
        ""
      );
    }
  } else {
    lines.push("✅ 현행 경고 한도를 유지합니다. 수동 승인이 필요하지 않습니다.", "");
  }
  lines.push(
    `${artifactLink(runUrl, "정책 보고서·이력·튜닝 HTML")}`,
    "",
    "> 승인 라벨은 검토 기록만 남기며 정책 한도를 자동 변경하지 않습니다."
  );
  return { approvalStatus, reviewCount: reviewItems.length, markdown: `${lines.join("\n")}\n` };
}
