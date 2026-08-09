import assert from "node:assert/strict";
import test from "node:test";
import { buildReleaseQualityTrend, seedReleaseQualityHistory } from "./lib/releaseQualityTrend.mjs";

function summary(sha, { lcp = 1200, frame = 20, map = 0, structural = 0 } = {}) {
  return {
    sha,
    generatedAt: `2026-08-10T00:00:0${sha.length}.000Z`,
    status: "passed",
    categories: [
      { id: "map", status: "passed", metrics: { changedRatio: map } },
      { id: "ios", status: "passed", metrics: { p95FrameMs: frame } },
      { id: "pwa", status: "passed", metrics: { largestContentfulPaintMs: lcp } }
    ],
    visualDifferences: { status: "passed", counts: { "structural-regression": structural } }
  };
}

test("release quality trend warms up then reports stable deltas", () => {
  const first = buildReleaseQualityTrend(summary("a"));
  const second = buildReleaseQualityTrend(summary("b", { lcp: 1280, frame: 21 }), first.history);

  assert.equal(first.trend.status, "warming");
  assert.equal(second.trend.status, "stable");
  assert.equal(second.trend.previousSha, "a");
  assert.equal(second.history.snapshots.length, 2);
});

test("release quality trend flags material regressions and de-duplicates rerun SHAs", () => {
  const first = buildReleaseQualityTrend(summary("a"));
  const regression = buildReleaseQualityTrend(
    summary("b", { lcp: 1800, frame: 30, map: 0.01, structural: 1 }),
    first.history
  );
  const rerun = buildReleaseQualityTrend(summary("b", { lcp: 1700 }), regression.history);

  assert.equal(regression.trend.status, "watch");
  assert.ok(regression.trend.regressions.some((issue) => issue.startsWith("pwa.largestContentfulPaintMs")));
  assert.ok(regression.trend.regressions.some((issue) => issue.startsWith("visual.structural-regression")));
  assert.equal(rerun.history.snapshots.length, 2);
});

test("release quality history seeds a previous artifact and replaces duplicate SHAs", () => {
  const history = seedReleaseQualityHistory({ version: 1, snapshots: [] }, [
    summary("a", { lcp: 1300 }),
    summary("a", { lcp: 1200 }),
    summary("b", { lcp: 1250 })
  ]);

  assert.deepEqual(history.snapshots.map(({ sha }) => sha), ["a", "b"]);
  assert.equal(history.snapshots[0].categories.pwa.metrics.largestContentfulPaintMs, 1200);
});
