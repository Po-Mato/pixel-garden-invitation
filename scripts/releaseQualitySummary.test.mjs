import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildReleaseQualitySummary, formatReleaseQualitySummaryMarkdown } from "./lib/releaseQualitySummary.mjs";

function cleanEvidence() {
  const device = {
    comparisons: [{ state: "game", passed: true, changedRatio: 0.001, rawChangedRatio: 0.008, maxChangedRatio: 0.015 }],
    retry: { attempted: false, reason: null },
    pwaOffline: {
      controlled: true,
      cachedPaths: 82,
      expectedPaths: 82,
      transportProbe: { transportBlocked: true, durationMs: 24, browserErrorKind: "failed-to-fetch" },
      criticalAssetFailures: [],
      pageErrors: []
    }
  };
  return {
    mapDiagnostics: { reports: [{ issues: [], snapshot: { policyStatus: "passed" } }] },
    mobileRegions: { changedRatio: 0, maxRegionChangedRatio: 0.02, regionResults: [{ id: "home", kind: "map", changedRatio: 0 }] },
    hud: { reports: [{ issues: [] }], typographyScaleAudit: { reports: [{ issues: [] }], issues: [] }, collisionMatrix: { reports: [], issues: [] } },
    android: device,
    ios: {
      ...device,
      landscape: {
        frameTimings: { p95FrameMs: 16 },
        interiorCenterProbe: { playerCenter: { errorPx: 0.5 } }
      }
    },
    pwaAssets: { trend: { groups: { core: { total: 82 }, features: { total: 40 } }, logicalChunkBudget: { status: "passed", evaluations: [{ logicalPath: "index.js" }], issues: [] } } },
    pwaNetwork: {
      issues: [],
      trend: { status: "passed" },
      freshColdStart: { largestContentfulPaintMs: 1200 }
    },
    pagesRuntimeContract: {
      status: "passed",
      issues: [],
      assets: { probes: Array.from({ length: 86 }) },
      serviceWorker: { allowedScope: "https://example.test/pixel-garden-invitation/" }
    },
    ciEfficiency: {
      status: "passed",
      metrics: { reportCount: 4, dependencyCacheHitRate: 0.75, sharedBuildRestoreRate: 1, estimatedSavedMs: 320_000, artifactBytes: 12_000_000 },
      trend: { cacheTiming: { cold: { p95RunDurationMs: 180_000 }, warm: { p95RunDurationMs: 120_000 } }, monthly: { runnerMinutes: 42, estimatedChargeUsd: 0 } }
    },
    evidenceEfficiency: {
      status: "warming",
      metrics: { storedBytes: 20_000_000, omittedDuplicateBytes: 6_000_000 },
      budgetCalibration: { effectiveMaximumStoredBytes: 130_000_000 }
    }
  };
}

test("release quality summary combines product and automation evidence groups", () => {
  const summary = buildReleaseQualitySummary(cleanEvidence(), { sha: "abc" });
  assert.equal(summary.status, "passed");
  assert.deepEqual(summary.categories.map(({ id, status }) => [id, status]), [
    ["map", "passed"], ["hud", "passed"], ["android", "passed"], ["ios", "passed"], ["pwa", "passed"], ["automation", "passed"]
  ]);
  assert.equal(summary.categories.find(({ id }) => id === "pwa").metrics.largestContentfulPaintMs, 1200);
  assert.equal(summary.categories.find(({ id }) => id === "pwa").metrics.pagesRuntimeAssets, 86);
  assert.equal(summary.categories.find(({ id }) => id === "ios").metrics.interiorPlayerCenterErrorPx, 0.5);
  assert.equal(summary.categories.find(({ id }) => id === "android").metrics.transportBlockLatencyMs, 24);
  assert.equal(summary.categories.find(({ id }) => id === "android").metrics.captureRetryAttempted, false);
  assert.equal(summary.visualDifferences.status, "passed");
  assert.equal(summary.visualDifferences.counts["renderer-noise"], 2);
  assert.match(formatReleaseQualitySummaryMarkdown(summary), /종합 상태: \*\*passed\*\*/);
});

test("release summary markdown exposes promoted repeated visual regions", () => {
  const summary = buildReleaseQualitySummary(cleanEvidence(), { sha: "abc" });
  summary.trend = {
    status: "watch",
    sampleCount: 3,
    previousSha: "def",
    regressions: [],
    watchStructural: {
      status: "review-required",
      promoted: [{ source: "ios", state: "game", consecutiveReleases: 3 }]
    }
  };
  const markdown = formatReleaseQualitySummaryMarkdown(summary);
  assert.match(markdown, /검토 승격: ios\/game · 3개 릴리스 연속/);
  assert.match(markdown, /반복 시각 변동 검토 필요: ios\/game/);
});

test("release summary markdown exposes engine-specific PWA transport alert state", () => {
  const summary = buildReleaseQualitySummary(cleanEvidence(), { sha: "abc" });
  summary.trend = {
    status: "stable",
    sampleCount: 3,
    previousSha: "def",
    regressions: [],
    watchStructural: { status: "clear", promoted: [] },
    devicePwaTransport: {
      status: "passed",
      platforms: {
        android: {
          engine: "Chromium",
          blockedSamples: 3,
          sampleCount: 3,
          p95LatencyMs: 48,
          errorKinds: { "failed-to-fetch": 3 },
          alert: { status: "armed", maximumP95LatencyMs: 750 }
        }
      },
      triggeredAlerts: []
    },
    androidCaptureRetry: { status: "passed", recoveredRetries: 1, retryAttempts: 1, sampleCount: 4, retryRate: 0.25 }
  };
  const markdown = formatReleaseQualitySummaryMarkdown(summary);
  assert.match(markdown, /android\/Chromium: 차단 3\/3 · p95 48ms\/750ms · 감시 armed/);
  assert.doesNotMatch(markdown, /PWA 알림 발생/);
  assert.match(markdown, /재시도 후 통과 1\/1 · 최근 4개 릴리스 중 25%/);
});

test("release quality summary respects the deployed PWA trend status", () => {
  const evidence = cleanEvidence();
  evidence.pwaNetwork.trend.status = "failed";

  const summary = buildReleaseQualitySummary(evidence);
  const pwa = summary.categories.find(({ id }) => id === "pwa");

  assert.equal(pwa.status, "failed");
  assert.ok(pwa.issues.includes("공개 네트워크 캔어리 failed"));
});

test("release quality summary distinguishes missing evidence from failed evidence", () => {
  const evidence = cleanEvidence();
  evidence.android = null;
  evidence.hud.reports[0].issues.push("HUD 겹침");
  const summary = buildReleaseQualitySummary(evidence);
  assert.equal(summary.status, "failed");
  assert.equal(summary.categories.find(({ id }) => id === "android").status, "blocked");
  assert.equal(summary.categories.find(({ id }) => id === "hud").status, "failed");
});

test("release quality workflow has one central trigger, waits for all commit workflows, and joins exact run artifacts", async () => {
  const workflow = await readFile(new URL("../.github/workflows/release-quality-summary.yml", import.meta.url), "utf8");
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /TARGET_SHA/);
  assert.match(workflow, /workflows: \[Mobile visual regression\]/);
  assert.doesNotMatch(workflow, /workflows:[\s\S]*Deploy client to GitHub Pages[\s\S]*types:/);
  assert.match(workflow, /check-release-workflow-readiness\.mjs/);
  assert.match(workflow, /--wait-timeout-ms 2700000/);
  assert.match(workflow, /--poll-interval-ms 20000/);
  assert.match(workflow, /timeout-minutes: 60/);
  assert.match(workflow, /steps\.release-gate\.outputs\.should_summarize == 'true'/);
  assert.match(workflow, /steps\.release-gate\.outputs\.pages_run_id/);
  assert.doesNotMatch(workflow, /for attempt in \{1\.\.36\}/);
  assert.match(workflow, /gh run download[\s\S]*\|\| true/);
  assert.match(workflow, /gh run download/);
  assert.match(workflow, /max_by\(\.id\)/);
  assert.match(workflow, /actions\/artifacts\/\$artifact_id\/zip/);
  assert.match(workflow, /unzip -qo "\$artifact_archive_dir\/artifact\.zip"/);
  assert.match(workflow, /quality:summary/);
  assert.match(workflow, /release-quality-history/);
  assert.match(workflow, /quality:summary-seed/);
  assert.match(workflow, /visual-diff-calibration-history/);
  assert.match(workflow, /while read -r previous_run_id/);
  assert.match(workflow, /quality:ci-efficiency/);
  assert.match(workflow, /record-quality-ci-run-timing\.mjs/);
  assert.match(workflow, /quality-ci-efficiency-history/);
  assert.match(workflow, /repository-visibility/);
  assert.match(workflow, /quality:evidence-efficiency/);
  assert.match(workflow, /quality-evidence-efficiency-history/);
  assert.match(workflow, /quality-ci-intentional-cold-/);
  assert.match(workflow, /--event workflow_dispatch/);
  assert.match(workflow, /has_cold_artifact/);
  assert.match(workflow, /record_run_timing cold-sample/);

  const releaseGate = await readFile(new URL("./lib/releaseWorkflowGate.mjs", import.meta.url), "utf8");
  assert.match(releaseGate, /pages\.yml/);
  assert.match(releaseGate, /visual-regression\.yml/);
  assert.match(releaseGate, /android-chrome-visual\.yml/);
  assert.match(releaseGate, /ios-safari-visual\.yml/);
});
