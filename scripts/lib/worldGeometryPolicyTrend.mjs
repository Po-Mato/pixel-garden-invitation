function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function escapeHtml(value) {
  return String(value).replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function snapshotFromReport(report, { sha, refLabel, generatedAt }) {
  if (!Array.isArray(report?.zones) || report.zones.length === 0) {
    throw new Error("world geometry policy report에 zones가 필요합니다");
  }
  return {
    sha,
    generatedAt,
    ...(refLabel ? { refLabel } : {}),
    zones: report.zones.map(({ zoneId, policy }) => ({
      zoneId,
      status: policy.status,
      blockingCount: policy.blockingCount,
      warningCount: policy.warningCount,
      maxWarnings: policy.maxWarnings
    }))
  };
}

export function buildWorldGeometryPolicyTrend(currentReport, history = { version: 1, snapshots: [] }, {
  sha = "local",
  refLabel = null,
  generatedAt = new Date().toISOString(),
  retention = 20,
  minimumSnapshots = 5
} = {}) {
  const current = snapshotFromReport(currentReport, { sha, refLabel, generatedAt });
  const previous = Array.isArray(history?.snapshots) ? history.snapshots : [];
  const snapshots = [...previous.filter((snapshot) => snapshot.sha !== sha), current].slice(-retention);
  const recommendations = current.zones.map((zone) => {
    const observations = snapshots.flatMap((snapshot) => {
      const match = snapshot.zones?.find((candidate) => candidate.zoneId === zone.zoneId);
      return match ? [match] : [];
    });
    const warningValues = observations.map((observation) => observation.warningCount);
    const warningRuns = warningValues.filter((count) => count > 0).length;
    const blockingRuns = observations.filter((observation) => observation.blockingCount > 0).length;
    const observedMaxWarnings = Math.max(0, ...warningValues);
    const p90Warnings = percentile(warningValues, 0.9);
    let action = "keep";
    let recommendedMaxWarnings = zone.maxWarnings;
    if (blockingRuns > 0) {
      action = "fix-blocking";
    } else if (observations.length >= minimumSnapshots && warningRuns >= Math.ceil(observations.length / 2) && p90Warnings > zone.maxWarnings) {
      action = "review-raise";
      recommendedMaxWarnings = Math.min(5, p90Warnings);
    } else if (observations.length >= minimumSnapshots && observedMaxWarnings < zone.maxWarnings) {
      action = "review-tighten";
      recommendedMaxWarnings = observedMaxWarnings;
    }
    return {
      zoneId: zone.zoneId,
      action,
      snapshotCount: observations.length,
      currentMaxWarnings: zone.maxWarnings,
      recommendedMaxWarnings,
      observedMaxWarnings,
      p90Warnings,
      warningRunRate: observations.length === 0 ? 0 : warningRuns / observations.length,
      blockingRuns
    };
  });
  return {
    history: { version: 1, snapshots },
    report: {
      version: 1,
      generatedAt,
      currentSha: sha,
      snapshotCount: snapshots.length,
      status: recommendations.some(({ action }) => action !== "keep") ? "review" : "stable",
      recommendations
    }
  };
}

export function renderWorldGeometryPolicyTrendHtml(history, report) {
  const latest = history.snapshots.at(-1);
  const actionLabel = {
    keep: "KEEP",
    "review-raise": "REVIEW RAISE",
    "review-tighten": "REVIEW TIGHTEN",
    "fix-blocking": "FIX BLOCKING"
  };
  const cards = report.recommendations.map((item) => `<article data-action="${item.action}">
    <header><span>${escapeHtml(item.zoneId)}</span><b>${actionLabel[item.action]}</b></header>
    <strong>${item.currentMaxWarnings} → ${item.recommendedMaxWarnings}</strong>
    <dl><div><dt>P90</dt><dd>${item.p90Warnings}</dd></div><div><dt>MAX</dt><dd>${item.observedMaxWarnings}</dd></div><div><dt>WARN RUNS</dt><dd>${Math.round(item.warningRunRate * 100)}%</dd></div><div><dt>BLOCK</dt><dd>${item.blockingRuns}</dd></div></dl>
  </article>`).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>World geometry policy tuning</title><style>
  :root{color-scheme:dark;background:#0f0f0e;color:#fff2c7;font-family:"Courier New",monospace}*{box-sizing:border-box}body{margin:0;padding:28px;background:repeating-linear-gradient(90deg,#0f0f0e 0 79px,#17211f 80px)}main{max-width:1100px;margin:auto}h1{margin:0;font:900 38px/.9 Georgia,serif;letter-spacing:-.05em}p{color:#aaa39a}.status{display:inline-block;margin:14px 0 20px;border:1px solid #4df2ff;padding:7px 10px;background:#14262a;color:#4df2ff;font-weight:900}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}article{border:1px solid #45413c;padding:11px;background:#191817;box-shadow:4px 4px 0 #050505}article[data-action="review-raise"],article[data-action="fix-blocking"]{border-color:#ff4d98}article[data-action="review-tighten"]{border-color:#ffc857}article header{display:flex;justify-content:space-between;gap:8px;color:#ff4d98;font-size:10px}article>strong{display:block;margin:15px 0;color:#68f5a6;font-size:28px}dl{display:grid;grid-template-columns:repeat(4,1fr);margin:0;border-top:1px solid #45413c}dl div{padding-top:8px}dt{color:#8e8880;font-size:8px}dd{margin:3px 0 0;color:#fff2c7;font-size:11px}</style></head><body><main><h1>POLICY TUNING TRACE</h1><p>${report.snapshotCount}개 CI 스냅샷 · ${escapeHtml(latest?.refLabel ?? "commit")} · ${escapeHtml(report.currentSha.slice(0,12))}</p><span class="status">${report.status.toUpperCase()}</span><section class="grid">${cards}</section></main></body></html>`;
}
