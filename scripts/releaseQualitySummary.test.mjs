import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildReleaseQualitySummary, formatReleaseQualitySummaryMarkdown } from "./lib/releaseQualitySummary.mjs";

function cleanEvidence() {
  const device = {
    comparisons: [{ state: "game", passed: true }],
    pwaOffline: { controlled: true, cachedPaths: 82, expectedPaths: 82, criticalAssetFailures: [], pageErrors: [] }
  };
  return {
    mapDiagnostics: { reports: [{ issues: [], snapshot: { policyStatus: "passed" } }] },
    mobileRegions: { changedRatio: 0, maxRegionChangedRatio: 0.02, regionResults: [{ id: "home", kind: "map", changedRatio: 0 }] },
    hud: { reports: [{ issues: [] }], typographyScaleAudit: { reports: [{ issues: [] }], issues: [] }, collisionMatrix: { reports: [], issues: [] } },
    android: device,
    ios: { ...device, landscape: { frameTimings: { p95FrameMs: 16 } } },
    pwaAssets: { trend: { groups: { core: { total: 82 }, features: { total: 40 } }, logicalChunkBudget: { status: "passed", evaluations: [{ logicalPath: "index.js" }], issues: [] } } },
    pwaNetwork: {
      issues: [],
      trend: { status: "passed" },
      freshColdStart: { largestContentfulPaintMs: 1200 }
    }
  };
}

test("release quality summary combines all five evidence groups", () => {
  const summary = buildReleaseQualitySummary(cleanEvidence(), { sha: "abc" });
  assert.equal(summary.status, "passed");
  assert.deepEqual(summary.categories.map(({ id, status }) => [id, status]), [
    ["map", "passed"], ["hud", "passed"], ["android", "passed"], ["ios", "passed"], ["pwa", "passed"]
  ]);
  assert.equal(summary.categories.find(({ id }) => id === "pwa").metrics.largestContentfulPaintMs, 1200);
  assert.match(formatReleaseQualitySummaryMarkdown(summary), /종합 상태: \*\*passed\*\*/);
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

test("release quality workflow joins completed artifacts by commit SHA", async () => {
  const workflow = await readFile(new URL("../.github/workflows/release-quality-summary.yml", import.meta.url), "utf8");
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /TARGET_SHA/);
  assert.match(workflow, /--status completed/);
  assert.match(workflow, /gh run download[\s\S]*\|\| true/);
  assert.match(workflow, /gh run download/);
  assert.match(workflow, /quality:summary/);
});
