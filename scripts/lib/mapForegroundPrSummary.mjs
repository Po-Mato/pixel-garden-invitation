export const mapForegroundSummaryMarker = "<!-- map-foreground-diagnostics -->";

function artifactLink(runUrl, label) {
  return runUrl ? `[${label}](${runUrl}#artifacts)` : label;
}

export function buildMapForegroundPrSummary(report, { runUrl = "", threshold = 8, trend = null } = {}) {
  const placements = Array.isArray(report.placements) ? report.placements : [];
  const closeDepths = placements.filter((placement) => (
    placement.depthMode === "floor" && placement.depthGap >= 0 && placement.depthGap <= threshold
  ));
  const lines = [
    mapForegroundSummaryMarker,
    "## 맵 전경 진단",
    "",
    report.status === "passed"
      ? `✅ ${report.zoneCount}개 구역 · ${report.instanceCount}개 전경 배치 검사를 통과했습니다.`
      : `❌ 전경 배치 검사에 실패했습니다${report.error ? `: ${report.error}` : "."}`,
    "",
    `알파 픽셀 하단과 깊이선 간격이 ${threshold}px 이하인 바닥 전경: **${closeDepths.length}개**`,
    ""
  ];

  if (closeDepths.length > 0) {
    lines.push(
      "| 구역 | 전경 | 간격 | 현재 depthY |",
      "| --- | --- | ---: | ---: |",
      ...closeDepths.map((placement) => (
        `| \`${placement.zoneId}\` | \`${placement.decorationId}\` | ${placement.depthGap}px | ${placement.depthY} |`
      )),
      ""
    );
  } else {
    lines.push("해당하는 작은 깊이 간격이 없습니다.", "");
  }

  lines.push(
    trend?.status === "warning"
      ? `⚠️ 이전 커밋 대비 depthGap 급변 **${trend.warningCount}개** (기준 ±${trend.warningDelta}px)`
      : trend?.status === "stable"
        ? `✅ 이전 커밋 대비 depthGap 급변 없음 · 일반 변경 ${trend.changeCount}개`
        : "ℹ️ depthGap 추세 기준 스냅샷을 준비했습니다.",
    "",
    `${artifactLink(runUrl, "감사 시트·JSON")} · ${artifactLink(runUrl, "모바일 진단 스크린샷")} · ${artifactLink(runUrl, "추천값·패치 JSON")} · ${artifactLink(runUrl, "depthGap 추세")}`,
    "",
    "> 추천값은 검토용입니다. 적용을 승인하려면 PR에 `map-foreground-patch-approved` 라벨을 추가하세요. 봇은 원 PR에 직접 쓰지 않고 체크섬 검증 후 별도 적용 PR을 만듭니다."
  );
  return `${lines.join("\n")}\n`;
}
