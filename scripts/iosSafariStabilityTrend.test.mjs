import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIosSafariStabilityTrend,
  formatIosSafariStabilityMarkdown,
  iosSafariStabilityPolicy,
  markApprovedIosSafariVisualFailures,
  mergeIosSafariStabilityHistory
} from "./lib/iosSafariStabilityTrend.mjs";

const currentPolicyRevision = iosSafariStabilityPolicy.policyRevision;

function sample(index, outcome = "success", policyRevision = 0, durationMs = 600_000) {
  return {
    runId: String(index), runAttempt: 1, sha: `sha-${index}`, outcome, durationMs,
    queueDurationMs: 12_000, setupDurationMs: 240_000, captureDurationMs: 360_000,
    capturePhaseDurationsMs: {
      "appium-readiness": 5_000,
      "wda-session": 115_000,
      "wda-preinstall": 33_000,
      "safari-navigation": 7_000,
      landscape: 180_000,
      "baseline-comparison": 60_000
    },
    capturePhaseSchemaVersion: 2,
    bridgeInstallDurationMs: 4_000, appiumCacheHit: true,
    wdaMode: policyRevision === currentPolicyRevision ? "preinstalled" : "source-build",
    generatedAt: `2026-08-${String(index).padStart(2, "0")}T00:00:00.000Z`, policyRevision
  };
}

test("iOS Safari history replaces rerun attempts by run identity", () => {
  const merged = mergeIosSafariStabilityHistory([
    sample(1, "failure"), sample(2)
  ], [{ ...sample(1), runAttempt: 2, outcome: "success" }]);
  assert.deepEqual(merged.map(({ runId, outcome }) => [runId, outcome]), [
    ["1", "success"], ["2", "success"]
  ]);
  assert.equal(merged[0].runAttempt, 2);
});

test("iOS Safari history keeps hardened timing evidence over API-only duplicates", () => {
  const merged = mergeIosSafariStabilityHistory([
    sample(1, "success", currentPolicyRevision)
  ], [{ ...sample(1, "failure", 0), setupDurationMs: 0, captureDurationMs: 0 }]);
  assert.equal(merged[0].policyRevision, currentPolicyRevision);
  assert.equal(merged[0].outcome, "success");
  assert.equal(merged[0].setupDurationMs, 240_000);
});

test("iOS Safari history applies an authoritative cancellation without dropping hardened timings", () => {
  const merged = mergeIosSafariStabilityHistory([
    sample(1, "failure", currentPolicyRevision)
  ], [{ ...sample(1, "cancelled", 0), setupDurationMs: 0, captureDurationMs: 0 }]);
  assert.equal(merged[0].outcome, "cancelled");
  assert.equal(merged[0].policyRevision, currentPolicyRevision);
  assert.equal(merged[0].setupDurationMs, 240_000);
});

test("iOS Safari trend quantifies ten historical runs but warms the hardened gate", () => {
  const trend = buildIosSafariStabilityTrend(Array.from({ length: 10 }, (_, index) => (
    sample(index + 1, index < 7 ? "success" : index === 9 ? "cancelled" : "failure")
  )));
  assert.equal(trend.observed.sampleCount, 9);
  assert.equal(trend.observed.successRate, 7 / 9);
  assert.equal(trend.observed.status, "warming");
  assert.equal(trend.excludedCancelledRuns, 1);
  assert.equal(trend.acceptance.status, "warming");
  assert.match(formatIosSafariStabilityMarkdown(trend), /7\/9 성공/);
  assert.match(formatIosSafariStabilityMarkdown(trend), /취소 제외 1회/);
});

test("iOS Safari trend backfills the reliability window past a cancelled run", () => {
  const trend = buildIosSafariStabilityTrend(Array.from({ length: 11 }, (_, index) => (
    sample(index + 1, index === 4 ? "failure" : index === 9 ? "cancelled" : "success")
  )));
  assert.equal(trend.observed.sampleCount, 10);
  assert.equal(trend.observed.successRate, 0.9);
  assert.equal(trend.observed.status, "passed");
});

test("approved iOS visual baselines supersede only ancestor visual and directions layout failures", async () => {
  const approvedCommitSha = "f".repeat(40);
  const visualFailureSha = "a".repeat(40);
  const directionsFailureSha = "b".repeat(40);
  const automationFailureSha = "c".repeat(40);
  const marked = await markApprovedIosSafariVisualFailures({
    samples: [
      {
        ...sample(1, "failure", currentPolicyRevision),
        sha: visualFailureSha,
        failureCategory: "product",
        failureKind: "product-visual-regression"
      },
      {
        ...sample(2, "failure", currentPolicyRevision),
        sha: directionsFailureSha,
        failureCategory: "product",
        failureKind: "product-directions-layout"
      },
      {
        ...sample(3, "failure", currentPolicyRevision),
        sha: automationFailureSha,
        failureCategory: "automation",
        failureKind: "automation-wda"
      }
    ],
    approvedCommitSha,
    isAncestor: async (sha) => [visualFailureSha, directionsFailureSha].includes(sha)
  });
  assert.equal(marked[0].supersededBySha, approvedCommitSha);
  assert.equal(marked[0].supersededReason, "approved-visual-baseline");
  assert.equal(marked[1].supersededBySha, approvedCommitSha);
  assert.equal(marked[1].supersededReason, "approved-visual-baseline");
  assert.equal(marked[2].supersededBySha, null);
});

test("approved visual drift is excluded without hiding later failures", () => {
  const runs = Array.from({ length: 10 }, (_, index) => ({
    ...sample(index + 1, index >= 5 && index <= 8 ? "failure" : "success", currentPolicyRevision),
    failureCategory: index >= 5 && index <= 8 ? "product" : null,
    failureKind: index >= 5 && index <= 8 ? "product-visual-regression" : null,
    supersededBySha: index >= 5 && index <= 8 ? "f".repeat(40) : null,
    supersededReason: index >= 5 && index <= 8 ? "approved-visual-baseline" : null
  }));
  const trend = buildIosSafariStabilityTrend(runs);
  assert.equal(trend.excludedSupersededVisualRuns, 4);
  assert.equal(trend.observed.sampleCount, 6);
  assert.equal(trend.observed.status, "warming");
  assert.equal(trend.acceptance.status, "warming");
  assert.match(formatIosSafariStabilityMarkdown(trend), /승인된 시각 변경 제외 4회/);
});

test("iOS Safari hardened gate accepts nine of ten bounded runs", () => {
  const trend = buildIosSafariStabilityTrend(Array.from({ length: 10 }, (_, index) => (
    {
      ...sample(index + 1, index === 4 ? "failure" : "success", currentPolicyRevision, 700_000 + index * 1_000),
      compositorFaultInjected: index >= 8,
      compositorFaultRecovered: index >= 8,
      compositorRecoveryCount: index >= 8 ? 1 : 0,
      compositorRecoveryDurationMs: index >= 8 ? 8_000 : 0,
      compositorRecoveryStrategy: index === 8 ? "activate-refresh" : index === 9 ? "recreate-session" : null
    }
  )));
  assert.equal(trend.acceptance.sampleCount, 10);
  assert.equal(trend.acceptance.status, "passed");
  assert.equal(trend.acceptance.successRate, 0.9);
  assert.equal(trend.acceptance.preinstalledWdaSamples, 10);
  assert.equal(trend.acceptance.cachedAppiumSamples, 10);
  assert.equal(trend.acceptance.p95QueueDurationMs, 12_000);
  assert.equal(trend.acceptance.p95BridgeInstallDurationMs, 4_000);
  assert.equal(trend.acceptance.p95WdaPreinstallDurationMs, 33_000);
  assert.equal(trend.acceptance.capturePhaseSchemaVersion, 2);
  assert.equal(trend.acceptance.phaseTimingSamples, 10);
  assert.match(formatIosSafariStabilityMarkdown(trend), /대기 p95 12초/);
  assert.match(formatIosSafariStabilityMarkdown(trend), /Appium 캐시 10\/10/);
  assert.match(formatIosSafariStabilityMarkdown(trend), /WDA 선설치 p95 33초\/40초 목표 passed/);
  assert.match(formatIosSafariStabilityMarkdown(trend), /준비 p95 240초/);
  assert.deepEqual(trend.acceptance.slowestCapturePhase, { name: "landscape", p95DurationMs: 180_000 });
  assert.match(formatIosSafariStabilityMarkdown(trend), /느린 단계 landscape p95 180초/);
  assert.match(formatIosSafariStabilityMarkdown(trend), /단계 v2 10\/10/);
  assert.match(formatIosSafariStabilityMarkdown(trend), /recreate 1\/1/);
});

test("iOS Safari phase trend excludes the legacy combined session setup", () => {
  const runs = Array.from({ length: 10 }, (_, index) => index === 0 ? {
    ...sample(index + 1, "success", currentPolicyRevision),
    capturePhaseSchemaVersion: 1,
    capturePhaseDurationsMs: { "session-setup": 398_402, landscape: 11_000 }
  } : sample(index + 1, "success", currentPolicyRevision));
  const trend = buildIosSafariStabilityTrend(runs);
  assert.equal(trend.acceptance.phaseTimingSamples, 9);
  assert.equal("session-setup" in trend.acceptance.p95CapturePhaseDurationsMs, false);
  assert.deepEqual(trend.acceptance.slowestCapturePhase, { name: "landscape", p95DurationMs: 180_000 });
});

test("iOS Safari phase schema is inferred for the first split timing sample", () => {
  const run = sample(1, "success", currentPolicyRevision);
  delete run.capturePhaseSchemaVersion;
  const trend = buildIosSafariStabilityTrend([run]);
  assert.equal(trend.acceptance.phaseTimingSamples, 1);
  assert.equal(trend.acceptance.capturePhaseSchemaVersion, 2);
});

test("iOS Safari hardened gate rejects clustered failures", () => {
  const trend = buildIosSafariStabilityTrend(Array.from({ length: 10 }, (_, index) => (
    sample(index + 1, [7, 8].includes(index) ? "failure" : "success", currentPolicyRevision)
  )));
  assert.equal(trend.acceptance.status, "failed");
  assert.ok(trend.acceptance.issues.some((issue) => issue.startsWith("연속 실패 2회")));
});

test("iOS Safari trend separates product, automation, and infrastructure failures", () => {
  const runs = Array.from({ length: 10 }, (_, index) => ({
    ...sample(index + 1, index < 3 ? "failure" : "success", currentPolicyRevision),
    failureCategory: index === 0 ? "product" : index === 1 ? "automation" : index === 2 ? "infrastructure" : null,
    failureKind: index === 0 ? "product-visual-regression" : index === 1 ? "automation-wda" : index === 2 ? "infrastructure-simulator" : null
  }));
  const trend = buildIosSafariStabilityTrend(runs);
  assert.deepEqual(trend.acceptance.failureCategories, {
    product: 1,
    automation: 1,
    infrastructure: 1,
    unknown: 0
  });
  assert.equal(trend.acceptance.failureKinds["automation-wda"], 1);
  assert.match(formatIosSafariStabilityMarkdown(trend), /실패 분류 제품 1\/자동화 1\/인프라 1/);
});

test("iOS Safari trend records one selective retry and its recovery category", () => {
  const runs = Array.from({ length: 10 }, (_, index) => ({
    ...sample(index + 1, "success", currentPolicyRevision),
    retryAttempted: index === 9,
    retryRecovered: index === 9,
    retryFailureCategory: index === 9 ? "automation" : null,
    retryFailureKind: index === 9 ? "automation-wda" : null,
    compositorFaultInjected: index >= 8,
    compositorFaultRecovered: index >= 8,
    compositorRecoveryCount: index >= 8 ? 1 : 0,
    compositorRecoveryStrategy: index === 8 ? "activate-refresh" : index === 9 ? "recreate-session" : null
  }));
  const trend = buildIosSafariStabilityTrend(runs);
  assert.equal(trend.acceptance.retryAttempts, 1);
  assert.equal(trend.acceptance.recoveredRetries, 1);
  assert.equal(trend.acceptance.retryFailureCategories.automation, 1);
  assert.match(formatIosSafariStabilityMarkdown(trend), /선택 재시도 1\/1 복구/);
});

test("iOS Safari stability reports the 40 second WDA target separately from the hard limit", () => {
  const runs = Array.from({ length: 10 }, (_, index) => ({
    ...sample(index + 1, "success", currentPolicyRevision),
    capturePhaseDurationsMs: {
      ...sample(index + 1).capturePhaseDurationsMs,
      "wda-preinstall": index === 9 ? 40_001 : 33_000
    }
  }));
  const trend = buildIosSafariStabilityTrend(runs);
  assert.equal(trend.acceptance.p95WdaPreinstallDurationMs, 40_001);
  assert.equal(trend.acceptance.wdaPreinstallTargetStatus, "watch");
  assert.equal(trend.acceptance.issues.some((issue) => issue.startsWith("WDA 선설치 p95")), false);
});

test("iOS Safari hardened gate rejects WDA preinstall p95 above 120 seconds", () => {
  const runs = Array.from({ length: 10 }, (_, index) => ({
    ...sample(index + 1, "success", currentPolicyRevision),
    capturePhaseDurationsMs: {
      ...sample(index + 1).capturePhaseDurationsMs,
      "wda-preinstall": index === 9 ? 120_001 : 33_000
    }
  }));
  const trend = buildIosSafariStabilityTrend(runs);
  assert.ok(trend.acceptance.issues.some((issue) => issue.startsWith("WDA 선설치 p95")));
});

test("iOS Safari hardened gate reports slow setup and capture phases", () => {
  const runs = Array.from({ length: 10 }, (_, index) => ({
    ...sample(index + 1, "success", currentPolicyRevision, 1_100_000),
    setupDurationMs: 500_000,
    captureDurationMs: 750_000
  }));
  const trend = buildIosSafariStabilityTrend(runs);
  assert.equal(trend.acceptance.status, "failed");
  assert.ok(trend.acceptance.issues.some((issue) => issue.startsWith("p95 준비 시간")));
  assert.ok(trend.acceptance.issues.some((issue) => issue.startsWith("p95 캡처 시간")));
});

test("iOS Safari trend tracks deterministic compositor recovery frequency and latency", () => {
  const runs = Array.from({ length: 10 }, (_, index) => ({
    ...sample(index + 1, "success", currentPolicyRevision),
    compositorRecoveryCount: index === 9 ? 1 : 0,
    compositorRecoveryDurationMs: index === 9 ? 8_400 : 0,
    compositorFaultInjected: index === 9,
    compositorFaultRecovered: index === 9,
    compositorRecoveryStrategy: index === 9 ? "activate-refresh" : null
  }));
  const trend = buildIosSafariStabilityTrend(runs);
  assert.equal(trend.acceptance.recoveryRuns, 1);
  assert.equal(trend.acceptance.recoveryRate, 0.1);
  assert.equal(trend.acceptance.p95RecoveryDurationMs, 8_400);
  assert.equal(trend.acceptance.successfulFaultRecoveries, 1);
  assert.match(formatIosSafariStabilityMarkdown(trend), /주입 복구 1\/1/);
});

test("iOS Safari hardened gate requires both scheduled recovery strategies", () => {
  const runs = Array.from({ length: 10 }, (_, index) => ({
    ...sample(index + 1, "success", currentPolicyRevision),
    compositorFaultInjected: index === 9,
    compositorFaultRecovered: index === 9,
    compositorRecoveryCount: index === 9 ? 1 : 0,
    compositorRecoveryStrategy: index === 9 ? "activate-refresh" : null
  }));
  const trend = buildIosSafariStabilityTrend(runs);
  assert.equal(trend.acceptance.status, "failed");
  assert.ok(trend.acceptance.issues.some((issue) => issue.startsWith("recreate-session 합성기 복구 표본")));
});

test("iOS Safari hardened gate keeps scheduled recovery coverage beyond the ten-run timing window", () => {
  const runs = Array.from({ length: 12 }, (_, index) => ({
    ...sample(index + 1, "success", currentPolicyRevision),
    compositorFaultInjected: index === 0 || index === 11,
    compositorFaultRecovered: index === 0 || index === 11,
    compositorRecoveryCount: index === 0 || index === 11 ? 1 : 0,
    compositorRecoveryStrategy: index === 0
      ? "recreate-session" : index === 11 ? "activate-refresh" : null
  }));
  const trend = buildIosSafariStabilityTrend(runs);
  assert.equal(trend.acceptance.sampleCount, 10);
  assert.equal(trend.acceptance.status, "passed");
  assert.equal(trend.acceptance.recoveryStrategies["recreate-session"].successes, 1);
  assert.equal(trend.acceptance.recoveryStrategies["activate-refresh"].successes, 1);
});
