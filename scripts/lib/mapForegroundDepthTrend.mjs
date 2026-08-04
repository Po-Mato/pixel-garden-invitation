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

function escapeHtml(value) {
  return String(value).replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&#39;",
    "\"": "&quot;"
  })[character]);
}

function sparkline(values, label) {
  const width = 180;
  const height = 48;
  const padding = 5;
  const minimum = Math.min(...values, 0);
  const maximum = Math.max(...values, 0);
  const range = Math.max(1, maximum - minimum);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? padding : padding + index * (width - padding * 2) / (values.length - 1);
    const y = height - padding - (value - minimum) * (height - padding * 2) / range;
    return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
  }).join(" ");
  const latest = points.split(" ").at(-1)?.split(",") ?? [padding, height - padding];
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)} depthGap 추세">` +
    `<line x1="${padding}" y1="${height - padding - (0 - minimum) * (height - padding * 2) / range}" x2="${width - padding}" y2="${height - padding - (0 - minimum) * (height - padding * 2) / range}" class="zero"/>` +
    `<polyline points="${points}"/>` +
    `<circle cx="${latest[0]}" cy="${latest[1]}" r="3"/>` +
    `</svg>`;
}

export function renderMapForegroundDepthTrendHtml(history, trend) {
  const snapshots = Array.isArray(history.snapshots) ? history.snapshots : [];
  const latestPlacements = snapshots.at(-1)?.placements ?? [];
  const cards = latestPlacements.map((placement) => {
    const values = snapshots.map((snapshot) => snapshot.placements.find((candidate) => (
      placementKey(candidate) === placementKey(placement)
    ))?.depthGap).filter((value) => Number.isFinite(value));
    const current = values.at(-1) ?? placement.depthGap;
    return `<article class="trace"><header><span>${escapeHtml(placement.zoneId)}</span><strong>${escapeHtml(placement.decorationId)}</strong></header>` +
      sparkline(values, placement.decorationId) +
      `<footer><b>${current}px</b><small>${values.length} commits</small></footer></article>`;
  }).join("");
  const warningRows = trend.warnings.map((warning) => (
    `<tr><td>${escapeHtml(warning.zoneId)}</td><td>${escapeHtml(warning.decorationId)}</td>` +
    `<td>${warning.previousDepthGap}px</td><td>${warning.currentDepthGap}px</td>` +
    `<td class="danger">${warning.delta > 0 ? "+" : ""}${warning.delta}px</td></tr>`
  )).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Map depthGap history</title><style>` +
    `:root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#11100f;color:#f8f0d7}` +
    `*{box-sizing:border-box}body{margin:0;padding:28px;background:#11100f}` +
    `main{max-width:1180px;margin:auto}h1{margin:0;font-size:28px;letter-spacing:-.04em}p{color:#aea69d}` +
    `.status{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 24px}.status b{border:1px solid #4df2ff;padding:7px 10px;background:#17272a;color:#d7fbff}` +
    `.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.trace{border:1px solid #3e3935;background:#1c1a19;padding:10px;box-shadow:3px 3px 0 #090909}` +
    `.trace header{display:grid;gap:3px}.trace header span{color:#ff4d98;font-size:10px;text-transform:uppercase}.trace header strong{overflow:hidden;text-overflow:ellipsis;font-size:12px}` +
    `svg{display:block;width:100%;height:58px;margin:8px 0;background:#151413}polyline{fill:none;stroke:#b89cff;stroke-width:2.5;vector-effect:non-scaling-stroke}circle{fill:#ffc857}.zero{stroke:#49433f;stroke-dasharray:3 3}` +
    `.trace footer{display:flex;justify-content:space-between;align-items:end}.trace footer b{font-size:18px;color:#4df2ff}.trace footer small{color:#89827c}` +
    `table{width:100%;border-collapse:collapse;margin-top:26px;font-size:12px}th,td{border-bottom:1px solid #3e3935;padding:8px;text-align:left}.danger{color:#ff6f9d;font-weight:900}` +
    `</style></head><body><main><h1>MAP DEPTH TRACE</h1>` +
    `<p>커밋별 전경 depthGap · 경고 기준 ±${trend.warningDelta}px · ${escapeHtml(trend.currentSha.slice(0, 12))}</p>` +
    `<section class="status"><b>${snapshots.length} SNAPSHOTS</b><b>${latestPlacements.length} FOREGROUNDS</b><b>${trend.warningCount} WARNINGS</b></section>` +
    `<section class="grid">${cards}</section>` +
    (warningRows ? `<table><thead><tr><th>ZONE</th><th>FOREGROUND</th><th>BEFORE</th><th>NOW</th><th>DELTA</th></tr></thead><tbody>${warningRows}</tbody></table>` : "") +
    `</main></body></html>\n`;
}
