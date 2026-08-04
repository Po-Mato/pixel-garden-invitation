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
  }, { runUrl: "https://github.com/example/repo/actions/runs/12", threshold: 8 });

  assert.ok(summary.startsWith(mapForegroundSummaryMarker));
  assert.match(summary, /깊이선 간격이.*\*\*1개\*\*/);
  assert.match(summary, /`home`.*`plant`.*5px/);
  assert.doesNotMatch(summary, /`desk`/);
  assert.doesNotMatch(summary, /`arch`/);
  assert.match(summary, /actions\/runs\/12#artifacts/);
});

test("PR summary renders failed audit details without placements", () => {
  const summary = buildMapForegroundPrSummary({ status: "failed", error: "bad geometry" });
  assert.match(summary, /❌.*bad geometry/);
  assert.match(summary, /해당하는 작은 깊이 간격이 없습니다/);
});
