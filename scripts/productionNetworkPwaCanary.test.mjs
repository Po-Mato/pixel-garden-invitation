import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  auditProductionNetworkPwaCanary,
  buildProductionNetworkCanaryUrl,
  parseServiceWorkerVersion,
  slow4gNetworkProfile
} from "./lib/productionNetworkPwaCanary.mjs";

const healthy = {
  readinessStatus: 200,
  expectedVersion: "abcdef123456",
  deployedVersion: "abcdef123456",
  freshColdStart: { entryVisible: true, entryVisibleMs: 4_500, layoutContained: true, pageErrors: [], failedRequests: [] },
  update: {
    previousVersion: "111111111111",
    previousControllerActive: true,
    installState: "installed",
    updatedControllerActive: true,
    updatedCacheComplete: true,
    previousCachePresent: false
  },
  updatedColdStart: { entryVisible: true, entryVisibleMs: 900, layoutContained: true, pageErrors: [], failedRequests: [] }
};

test("production network canary defines a deterministic slow 4G profile", () => {
  assert.equal(slow4gNetworkProfile.latency, 150);
  assert.equal(slow4gNetworkProfile.downloadThroughput, 200_000);
  assert.equal(slow4gNetworkProfile.connectionType, "cellular4g");
});

test("production network canary parses deployed worker versions and HTTPS URLs", () => {
  assert.equal(parseServiceWorkerVersion('const VERSION = "abcdef123456";'), "abcdef123456");
  assert.equal(
    buildProductionNetworkCanaryUrl("https://example.com/wedding/", "fresh"),
    "https://example.com/wedding/?quality-network-pwa=fresh"
  );
  assert.throws(() => buildProductionNetworkCanaryUrl("http://example.com/", "fresh"), /HTTPS/);
});

test("production network canary accepts atomic updates and cold starts", () => {
  assert.deepEqual(auditProductionNetworkPwaCanary(healthy), []);
  const issues = auditProductionNetworkPwaCanary({
    ...healthy,
    freshColdStart: { ...healthy.freshColdStart, entryVisibleMs: 12_001 },
    update: { ...healthy.update, updatedCacheComplete: false, previousCachePresent: true },
    updatedColdStart: { ...healthy.updatedColdStart, layoutContained: false }
  });
  assert.ok(issues.some((issue) => issue.includes("최초 진입")));
  assert.ok(issues.some((issue) => issue.includes("프리캐시")));
  assert.ok(issues.some((issue) => issue.includes("이전 서비스 워커 캐시")));
  assert.ok(issues.some((issue) => issue.includes("화면 넘침")));
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
});
