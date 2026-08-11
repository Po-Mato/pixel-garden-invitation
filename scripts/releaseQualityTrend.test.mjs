import assert from "node:assert/strict";
import test from "node:test";
import {
  androidCaptureRetryTrendPolicy,
  buildAndroidCaptureRetryTrend,
  buildDevicePwaTransportTrend,
  buildReleaseQualityTrend,
  devicePwaTransportTrendPolicy,
  seedReleaseQualityHistory
} from "./lib/releaseQualityTrend.mjs";

function summary(sha, { lcp = 1200, frame = 20, map = 0, structural = 0, watchKeys = [] } = {}) {
  return {
    sha,
    generatedAt: `2026-08-10T00:00:0${sha.length}.000Z`,
    status: "passed",
    categories: [
      { id: "map", status: "passed", metrics: { changedRatio: map } },
      { id: "ios", status: "passed", metrics: { p95FrameMs: frame } },
      { id: "pwa", status: "passed", metrics: { largestContentfulPaintMs: lcp } }
    ],
    visualDifferences: {
      status: watchKeys.length > 0 ? "watch" : "passed",
      counts: { "structural-regression": structural, "watch-structural": watchKeys.length },
      details: watchKeys.map((key) => {
        const [source, state] = key.split("::");
        return { source, state, classification: { id: "watch-structural" } };
      })
    }
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

test("the same watch-structural region is promoted after three consecutive releases", () => {
  const key = "ios::game-landscape-chrome-expanded";
  const first = buildReleaseQualityTrend(summary("a", { watchKeys: [key] }));
  const second = buildReleaseQualityTrend(summary("bb", { watchKeys: [key] }), first.history);
  const third = buildReleaseQualityTrend(summary("ccc", { watchKeys: [key] }), second.history);

  assert.equal(second.trend.watchStructural.status, "observing");
  assert.equal(third.trend.status, "watch");
  assert.equal(third.trend.watchStructural.status, "review-required");
  assert.deepEqual(third.trend.watchStructural.promoted[0], {
    key,
    source: "ios",
    state: "game-landscape-chrome-expanded",
    consecutiveReleases: 3,
    requiredReleases: 3,
    releaseShas: ["a", "bb", "ccc"],
    promoted: true
  });
});

test("a clean intervening release resets the watch-structural streak", () => {
  const key = "ios::game";
  const first = buildReleaseQualityTrend(summary("a", { watchKeys: [key] }));
  const clean = buildReleaseQualityTrend(summary("bb"), first.history);
  const current = buildReleaseQualityTrend(summary("ccc", { watchKeys: [key] }), clean.history);
  assert.equal(current.trend.watchStructural.candidates[0].consecutiveReleases, 1);
  assert.equal(current.trend.watchStructural.status, "observing");
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

test("device PWA transport trend keeps engine-specific errors and enforces p95 latency", () => {
  const snapshots = Array.from({ length: 3 }, (_, index) => ({
    sha: `sha-${index}`,
    generatedAt: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    categories: {
      android: { metrics: { transportBlocked: true, transportBlockLatencyMs: 40 + index, transportErrorKind: "failed-to-fetch" } },
      ios: { metrics: { transportBlocked: true, transportBlockLatencyMs: index === 2 ? 2_001 : 55, transportErrorKind: "load-failed" } }
    }
  }));
  const trend = buildDevicePwaTransportTrend(snapshots);
  assert.equal(devicePwaTransportTrendPolicy.observedWindow, 10);
  assert.equal(devicePwaTransportTrendPolicy.platforms.android.maximumP95LatencyMs, 750);
  assert.equal(devicePwaTransportTrendPolicy.platforms.ios.maximumP95LatencyMs, 1_000);
  assert.equal(trend.platforms.android.status, "passed");
  assert.equal(trend.platforms.android.errorKinds["failed-to-fetch"], 3);
  assert.equal(trend.platforms.android.alert.status, "armed");
  assert.equal(trend.monitors.length, 2);
  assert.equal(trend.activeAlerts.length, 1);
  assert.equal(trend.platforms.android.alert.active, true);
  assert.equal(trend.platforms.ios.status, "watch");
  assert.equal(trend.platforms.ios.p95LatencyMs, 2_001);
  assert.equal(trend.platforms.ios.alert.status, "triggered");
  assert.equal(trend.triggeredAlerts[0].engine, "WebKit");
  assert.equal(trend.status, "watch");
});

test("device PWA engine alerts remain inactive until the third distinct release", () => {
  const snapshots = Array.from({ length: 2 }, (_, index) => ({
    sha: `sha-${index}`,
    generatedAt: `2026-08-0${index + 1}T00:00:00.000Z`,
    categories: {
      android: { metrics: { transportBlocked: true, transportBlockLatencyMs: 900, transportErrorKind: "failed-to-fetch" } },
      ios: { metrics: { transportBlocked: true, transportBlockLatencyMs: 1_200, transportErrorKind: "load-failed" } }
    }
  }));
  const trend = buildDevicePwaTransportTrend(snapshots);
  assert.equal(trend.status, "warming");
  assert.equal(trend.platforms.android.alert.active, false);
  assert.equal(trend.platforms.ios.alert.active, false);
  assert.equal(trend.monitors.length, 0);
  assert.equal(trend.activeAlerts.length, 0);
  assert.equal(trend.triggeredAlerts.length, 0);
});

test("Android capture retry trend aggregates recovered renderer disconnects", () => {
  const snapshots = Array.from({ length: 5 }, (_, index) => ({
    sha: `sha-${index}`,
    generatedAt: `2026-08-0${index + 1}T00:00:00.000Z`,
    categories: {
      android: {
        status: "passed",
        metrics: {
          captureRetryAttempted: index === 1 || index === 4,
          captureRetryReason: index === 1 || index === 4 ? "renderer-disconnect" : null
        }
      }
    }
  }));
  const trend = buildAndroidCaptureRetryTrend(snapshots);
  assert.equal(androidCaptureRetryTrendPolicy.observedWindow, 10);
  assert.equal(trend.sampleCount, 5);
  assert.equal(trend.retryAttempts, 2);
  assert.equal(trend.recoveredRetries, 2);
  assert.equal(trend.retryRate, 0.4);
  assert.deepEqual(trend.reasons, { "renderer-disconnect": 2 });
  assert.equal(trend.status, "watch");
  assert.equal(trend.alert.status, "triggered");
});

test("Android retry trend does not alert on one isolated recovery", () => {
  const snapshots = Array.from({ length: 4 }, (_, index) => ({
    sha: `sha-${index}`,
    categories: {
      android: {
        status: "passed",
        metrics: { captureRetryAttempted: index === 0, captureRetryReason: index === 0 ? "renderer-disconnect" : null }
      }
    }
  }));
  const trend = buildAndroidCaptureRetryTrend(snapshots);
  assert.equal(trend.retryRate, 0.25);
  assert.equal(trend.status, "passed");
  assert.equal(trend.alert.status, "armed");
});
