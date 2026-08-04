export const mapForegroundSummaryMarker = "<!-- map-foreground-diagnostics -->";

function artifactLink(runUrl, label) {
  return runUrl ? `[${label}](${runUrl}#artifacts)` : label;
}

export function buildMapForegroundPrSummary(report, { runUrl = "", threshold = 8 } = {}) {
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
    `${artifactLink(runUrl, "감사 시트·JSON")} · ${artifactLink(runUrl, "모바일 진단 스크린샷")} · ${artifactLink(runUrl, "추천값 JSON")}`,
    "",
    "> 추천값은 검토용이며 배치 계약을 자동 수정하지 않습니다."
  );
  return `${lines.join("\n")}\n`;
}
