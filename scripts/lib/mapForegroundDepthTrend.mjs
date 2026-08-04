function placementKey(placement) {
  return `${placement.zoneId}/${placement.decorationId}`;
}

export function createMapForegroundDepthSnapshot(report, {
  sha,
  generatedAt = new Date().toISOString()
}) {
  if (!sha) throw new Error("depthGap 스냅샷에는 커밋 SHA가 필요합니다");
  return {
    sha,
    generatedAt,
    placements: (report.placements ?? []).map((placement) => ({
      zoneId: placement.zoneId,
      decorationId: placement.decorationId,
      depthMode: placement.depthMode,
      depthY: placement.depthY,
      visibleBottom: placement.visibleBottom,
      depthGap: placement.depthGap
    }))
  };
}

export function buildMapForegroundDepthTrend(report, history = { version: 1, snapshots: [] }, {
  sha,
  warningDelta = 12,
  generatedAt = new Date().toISOString(),
  historyLimit = 20
}) {
  if (!Number.isFinite(warningDelta) || warningDelta < 0) {
    throw new Error("depthGap 경고 기준은 0 이상의 숫자여야 합니다");
  }
  const snapshots = Array.isArray(history.snapshots) ? history.snapshots : [];
  const current = createMapForegroundDepthSnapshot(report, { sha, generatedAt });
  const baseline = [...snapshots].reverse().find((snapshot) => snapshot.sha !== sha) ?? null;
  const baselinePlacements = new Map((baseline?.placements ?? []).map((placement) => [placementKey(placement), placement]));
  const currentPlacements = new Map(current.placements.map((placement) => [placementKey(placement), placement]));
  const changes = [];

  for (const placement of current.placements) {
    const previous = baselinePlacements.get(placementKey(placement));
    if (!previous) continue;
    const delta = placement.depthGap - previous.depthGap;
    if (delta === 0) continue;
    changes.push({
      zoneId: placement.zoneId,
      decorationId: placement.decorationId,
      previousDepthGap: previous.depthGap,
      currentDepthGap: placement.depthGap,
      delta,
      severity: Math.abs(delta) >= warningDelta ? "warning" : "stable"
    });
  }

  const added = current.placements
    .filter((placement) => !baselinePlacements.has(placementKey(placement)))
    .map(({ zoneId, decorationId }) => ({ zoneId, decorationId }));
  const removed = (baseline?.placements ?? [])
    .filter((placement) => !currentPlacements.has(placementKey(placement)))
    .map(({ zoneId, decorationId }) => ({ zoneId, decorationId }));
  const warnings = changes.filter((change) => change.severity === "warning");
  const updatedSnapshots = [
    ...snapshots.filter((snapshot) => snapshot.sha !== sha),
    current
  ].slice(-historyLimit);

  return {
    report: {
      version: 1,
      status: baseline ? warnings.length > 0 ? "warning" : "stable" : "baseline-missing",
      currentSha: sha,
      baselineSha: baseline?.sha ?? null,
      warningDelta,
      warningCount: warnings.length,
      changeCount: changes.length,
      addedCount: added.length,
      removedCount: removed.length,
      changes,
      warnings,
      added,
      removed
    },
    history: { version: 1, snapshots: updatedSnapshots }
  };
}

export function renderMapForegroundDepthTrendMarkdown(trend) {
  const lines = ["## 전경 depthGap 추세", ""];
  if (trend.status === "baseline-missing") {
    lines.push("기준 스냅샷을 생성했습니다. 다음 커밋부터 급격한 변화만 경고합니다.");
  } else {
    lines.push(
      `기준 \`${trend.baselineSha?.slice(0, 7)}\` → 현재 \`${trend.currentSha.slice(0, 7)}\` · ` +
      `변경 ${trend.changeCount}개 · 경고 ${trend.warningCount}개 (기준 ±${trend.warningDelta}px)`
    );
    if (trend.warnings.length > 0) {
      lines.push(
        "",
        "| 구역 | 전경 | 이전 | 현재 | 변화 |",
        "| --- | --- | ---: | ---: | ---: |",
        ...trend.warnings.map((warning) => (
          `| \`${warning.zoneId}\` | \`${warning.decorationId}\` | ${warning.previousDepthGap}px | ${warning.currentDepthGap}px | ${warning.delta > 0 ? "+" : ""}${warning.delta}px |`
        ))
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
