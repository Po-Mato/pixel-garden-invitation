import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMapForegroundPrSummary,
  mapForegroundSummaryMarker
} from "./lib/mapForegroundPrSummary.mjs";

test("PR summary lists only small non-negative floor depth gaps and artifact links", () => {
  const summary = buildMapForegroundPrSummary({
    status: "passed",
    zoneCount: 2,
    instanceCount: 3,
    placements: [
      { zoneId: "home", decorationId: "plant", depthMode: "floor", depthGap: 5, depthY: 80 },
      { zoneId: "lobby", decorationId: "desk", depthMode: "floor", depthGap: 12, depthY: 100 },
      { zoneId: "hall", decorationId: "arch", depthMode: "overhead", depthGap: 0, depthY: 120 }
    ]
  }, {
    runUrl: "https://github.com/example/repo/actions/runs/12",
    threshold: 8,
    trend: { status: "stable", warningCount: 0, warningDelta: 12, changeCount: 2 }
  });

  assert.ok(summary.startsWith(mapForegroundSummaryMarker));
  assert.match(summary, /깊이선 간격이.*\*\*1개\*\*/);
  assert.match(summary, /`home`.*`plant`.*5px/);
  assert.doesNotMatch(summary, /`desk`/);
  assert.doesNotMatch(summary, /`arch`/);
  assert.match(summary, /actions\/runs\/12#artifacts/);
  assert.match(summary, /depthGap 급변 없음.*일반 변경 2개/);
  assert.match(summary, /map-foreground-patch-approved/);
  assert.match(summary, /별도 적용 PR/);
});

test("PR summary renders failed audit details without placements", () => {
  const summary = buildMapForegroundPrSummary({ status: "failed", error: "bad geometry" });
  assert.match(summary, /❌.*bad geometry/);
  assert.match(summary, /해당하는 작은 깊이 간격이 없습니다/);
  assert.match(summary, /추세 기준 스냅샷/);
});

test("PR summary surfaces only sudden depth gap trend warnings", () => {
  const summary = buildMapForegroundPrSummary({ status: "passed", zoneCount: 1, instanceCount: 1, placements: [] }, {
    trend: { status: "warning", warningCount: 2, warningDelta: 12, changeCount: 3 }
  });
  assert.match(summary, /depthGap 급변 \*\*2개\*\*.*±12px/);
});
