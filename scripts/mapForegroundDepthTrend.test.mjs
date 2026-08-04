import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMapForegroundDepthTrend,
  createMapForegroundDepthSnapshot,
  renderMapForegroundDepthTrendHtml,
  renderMapForegroundDepthTrendMarkdown
} from "./lib/mapForegroundDepthTrend.mjs";

function auditReport(depthGap = 5) {
  return {
    status: "passed",
    placements: [{
      zoneId: "lobby",
      decorationId: "desk",
      depthMode: "floor",
      depthY: 100 + depthGap,
      visibleBottom: 100,
      depthGap
    }]
  };
}

test("depth trend creates an initial baseline without warnings", () => {
  const result = buildMapForegroundDepthTrend(auditReport(), { version: 1, snapshots: [] }, {
    sha: "current",
    warningDelta: 12,
    generatedAt: "2026-08-04T00:00:00.000Z"
  });
  assert.equal(result.report.status, "baseline-missing");
  assert.equal(result.report.warningCount, 0);
  assert.equal(result.history.snapshots.length, 1);
  assert.match(renderMapForegroundDepthTrendMarkdown(result.report), /기준 스냅샷을 생성/);
});

test("depth trend warns only when absolute gap change reaches the threshold", () => {
  const baseline = createMapForegroundDepthSnapshot(auditReport(5), {
    sha: "previous",
    generatedAt: "2026-08-03T00:00:00.000Z"
  });
  const stable = buildMapForegroundDepthTrend(auditReport(14), { version: 1, snapshots: [baseline] }, {
    sha: "stable",
    warningDelta: 12
  });
  assert.equal(stable.report.status, "stable");
  assert.equal(stable.report.changeCount, 1);
  assert.equal(stable.report.warningCount, 0);

  const warning = buildMapForegroundDepthTrend(auditReport(-7), { version: 1, snapshots: [baseline] }, {
    sha: "warning",
    warningDelta: 12
  });
  assert.equal(warning.report.status, "warning");
  assert.equal(warning.report.warningCount, 1);
  assert.equal(warning.report.warnings[0].delta, -12);
  assert.match(renderMapForegroundDepthTrendMarkdown(warning.report), /`lobby`.*`desk`.*-12px/);
});

test("depth trend deduplicates rerun SHAs and retains bounded history", () => {
  const snapshots = Array.from({ length: 4 }, (_, index) => createMapForegroundDepthSnapshot(auditReport(index), {
    sha: `sha-${index}`,
    generatedAt: `2026-08-0${index + 1}T00:00:00.000Z`,
    refLabel: index === 2 ? "tag:v2.0.0" : `branch:main-${index}`
  }));
  const result = buildMapForegroundDepthTrend(auditReport(9), { version: 1, snapshots }, {
    sha: "sha-3",
    warningDelta: 12,
    historyLimit: 3
  });
  assert.deepEqual(result.history.snapshots.map(({ sha }) => sha), ["sha-1", "sha-2", "sha-3"]);
  assert.equal(result.report.baselineSha, "sha-2");
  const html = renderMapForegroundDepthTrendHtml(result.history, result.report);
  assert.match(html, /<!doctype html>/);
  assert.match(html, /MAP DEPTH TRACE/);
  assert.match(html, /desk/);
  assert.match(html, /<polyline/);
  assert.match(html, /비교 기준 커밋 또는 릴리스 태그/);
  assert.match(html, /tag:v2\.0\.0 · sha-2/);
  assert.match(html, /depth-history-data/);
  assert.match(html, /select\.addEventListener\("change",render\)/);
  assert.doesNotMatch(html, /https?:\/\//);
});
