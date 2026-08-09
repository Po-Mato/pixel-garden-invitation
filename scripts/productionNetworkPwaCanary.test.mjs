import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  auditProductionNetworkPwaCanary,
  buildProductionNetworkCanaryUrl,
  assessProductionNetworkPwaTrend,
  mergeProductionNetworkPwaTrendRuns,
  parseServiceWorkerVersion,
  productionNetworkPwaTrendSample,
  slow4gNetworkProfile,
  waitForPublicPrecacheAvailability
} from "./lib/productionNetworkPwaCanary.mjs";

const healthy = {
  readinessStatus: 200,
  expectedVersion: "abcdef123456",
  deployedVersion: "abcdef123456",
  freshColdStart: { entryVisible: true, entryVisibleMs: 4_500, layoutContained: true, largestContentfulPaintSupported: true, largestContentfulPaintMs: 2_200, pageErrors: [], failedRequests: [] },
  update: {
    previousVersion: "111111111111",
    previousControllerActive: true,
    installState: "installed",
    installDurationMs: 3_500,
    updatedControllerActive: true,
    updatedCacheComplete: true,
    expectedPaths: 44,
    expectedFeaturePaths: 58,
    previousCachePresent: false
  },
  updatedColdStart: { entryVisible: true, entryVisibleMs: 900, layoutContained: true, largestContentfulPaintSupported: true, largestContentfulPaintMs: 700, pageErrors: [], failedRequests: [] }
};

test("production network canary defines a deterministic slow 4G profile", () => {
  assert.equal(slow4gNetworkProfile.latency, 150);
  assert.equal(slow4gNetworkProfile.downloadThroughput, 200_000);
  assert.equal(slow4gNetworkProfile.connectionType, "cellular4g");
});

test("production network trend warms to five runs then gates LCP and update installation drift", () => {
  const sample = (runId, lcp, install) => ({
    runId, expectedSha: runId, generatedAt: `2026-08-0${runId}T00:00:00.000Z`,
    status: "passed", largestContentfulPaintMs: lcp, updateInstallMs: install
  });
  const previous = [sample("1", 1_000, 800), sample("2", 1_100, 900), sample("3", 1_200, 1_000)];
  assert.equal(assessProductionNetworkPwaTrend(previous, sample("4", 1_150, 950)).status, "warming");
  const passed = assessProductionNetworkPwaTrend([...previous, sample("4", 1_150, 950)], sample("5", 1_300, 1_200));
  assert.equal(passed.status, "passed");
  const failed = assessProductionNetworkPwaTrend([...previous, sample("4", 1_150, 950)], sample("5", 2_001, 4_000));
  assert.equal(failed.status, "failed");
  assert.equal(failed.issues.length, 2);
});

test("production network trend extracts valid reports and de-duplicates deployment identities", () => {
  const report = { generatedAt: "2026-08-08T00:00:00.000Z", expectedSha: "sha", issues: [], freshColdStart: { largestContentfulPaintMs: 1_100 }, update: { installDurationMs: 900 } };
  const sample = productionNetworkPwaTrendSample(report, "42");
  assert.deepEqual(sample, {
    runId: "42", expectedSha: "sha", generatedAt: report.generatedAt, status: "passed",
    largestContentfulPaintMs: 1_100, updateInstallMs: 900
  });
  assert.equal(productionNetworkPwaTrendSample({ ...report, update: {} }, "43"), null);
  assert.deepEqual(mergeProductionNetworkPwaTrendRuns([sample], [{ ...sample, largestContentfulPaintMs: 1_200 }]), [
    { ...sample, largestContentfulPaintMs: 1_200 }
  ]);
  assert.deepEqual(mergeProductionNetworkPwaTrendRuns([sample], [{ ...sample, runId: "43" }]), [
    { ...sample, runId: "43" }
  ]);
  assert.deepEqual(mergeProductionNetworkPwaTrendRuns([
    { ...sample, runId: "41" },
    { ...sample, runId: "42", generatedAt: "2026-08-08T01:00:00.000Z" }
  ], []), [
    { ...sample, runId: "42", generatedAt: "2026-08-08T01:00:00.000Z" }
  ]);
});

test("production network trend cannot be warmed by rerunning the same deployment SHA", () => {
  const sample = (runId, expectedSha) => ({
    runId, expectedSha, generatedAt: `2026-08-08T00:00:0${runId}.000Z`, status: "passed",
    largestContentfulPaintMs: 1_100, updateInstallMs: 900
  });
  const current = sample("5", "sha-current");
  const trend = assessProductionNetworkPwaTrend([
    sample("1", "sha-one"),
    sample("2", "sha-one"),
    sample("3", "sha-two"),
    sample("4", "sha-current")
  ], current);
  assert.equal(trend.status, "warming");
  assert.equal(trend.sampleCount, 3);
  assert.deepEqual(trend.baselineRunIds, ["2", "3"]);
});

test("production network canary parses deployed worker versions and HTTPS URLs", () => {
  assert.equal(parseServiceWorkerVersion('const VERSION = "abcdef123456";'), "abcdef123456");
  assert.equal(
    buildProductionNetworkCanaryUrl("https://example.com/wedding/", "fresh"),
    "https://example.com/wedding/?quality-network-pwa=fresh"
  );
  assert.throws(() => buildProductionNetworkCanaryUrl("http://example.com/", "fresh"), /HTTPS/);
});

test("production network canary waits until every deployed precache asset is available", async () => {
  let calls = 0;
  const result = await waitForPublicPrecacheAvailability("https://example.test/wedding/", ["./", "./app.js"], {
    attempts: 2,
    intervalMs: 0,
    fetchImpl: async (url) => {
      calls += 1;
      const unavailable = calls === 2 && String(url).endsWith("/app.js");
      return new Response("asset", { status: unavailable ? 404 : 200 });
    }
  });
  assert.deepEqual(result, { attempt: 2, checkedPaths: 2 });
  await assert.rejects(() => waitForPublicPrecacheAvailability(
    "https://example.test/wedding/",
    ["./missing.js"],
    { attempts: 1, intervalMs: 0, fetchImpl: async () => new Response("missing", { status: 404 }) }
  ), /missing\.js\(404\)/);
});

test("production network canary accepts atomic updates and cold starts", () => {
  assert.deepEqual(auditProductionNetworkPwaCanary(healthy), []);
  const issues = auditProductionNetworkPwaCanary({
    ...healthy,
    freshColdStart: { ...healthy.freshColdStart, entryVisibleMs: 12_001, largestContentfulPaintMs: 4_001 },
    update: { ...healthy.update, updatedCacheComplete: false, expectedPaths: 91, expectedFeaturePaths: 0, previousCachePresent: true },
    updatedColdStart: { ...healthy.updatedColdStart, layoutContained: false, largestContentfulPaintSupported: false, largestContentfulPaintMs: null }
  });
  assert.ok(issues.some((issue) => issue.includes("최초 진입")));
  assert.ok(issues.some((issue) => issue.includes("프리캐시")));
  assert.ok(issues.some((issue) => issue.includes("이전 서비스 워커 캐시")));
  assert.ok(issues.some((issue) => issue.includes("화면 넘침")));
  assert.ok(issues.some((issue) => issue.includes("느린 4G LCP")));
  assert.ok(issues.some((issue) => issue.includes("핵심 프리캐시 과다")));
  assert.ok(issues.some((issue) => issue.includes("선택 기능 캐시 분리")));
  assert.ok(issues.some((issue) => issue.includes("교체 후 LCP 관측")));
});

test("Pages prepares the old worker before deploy and verifies the new worker after deploy", () => {
  const workflow = readFileSync(".github/workflows/pages.yml", "utf8");
  const prepareAt = workflow.indexOf("--phase prepare");
  const deployAt = workflow.indexOf("id: deployment");
  const verifyAt = workflow.indexOf("--phase verify");
  assert.ok(prepareAt >= 0);
  assert.ok(deployAt > prepareAt);
  assert.ok(verifyAt > deployAt);
  assert.match(workflow.slice(verifyAt), /--expected-sha "\$GITHUB_SHA"/);
  assert.match(workflow, /Restore public PWA deployment trend/);
  assert.match(workflow, /seed-production-network-pwa-trend-history\.mjs/);
  assert.match(workflow, /Save public PWA deployment trend/);
});
