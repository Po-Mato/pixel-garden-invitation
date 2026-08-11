import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIosSafariStabilityTrend,
  formatIosSafariStabilityMarkdown,
  mergeIosSafariStabilityHistory
} from "./lib/iosSafariStabilityTrend.mjs";

function sample(index, outcome = "success", policyRevision = 0, durationMs = 600_000) {
  return {
    runId: String(index), runAttempt: 1, sha: `sha-${index}`, outcome, durationMs,
    queueDurationMs: 12_000, setupDurationMs: 240_000, captureDurationMs: 360_000,
    capturePhaseDurationsMs: {
      "appium-readiness": 5_000,
      "wda-session": 115_000,
      landscape: 180_000,
      "baseline-comparison": 60_000
    },
    bridgeInstallDurationMs: 4_000, appiumCacheHit: true,
    wdaMode: policyRevision === 3 ? "preinstalled" : "source-build",
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
    sample(1, "success", 3)
  ], [{ ...sample(1, "failure", 0), setupDurationMs: 0, captureDurationMs: 0 }]);
  assert.equal(merged[0].policyRevision, 3);
  assert.equal(merged[0].outcome, "success");
  assert.equal(merged[0].setupDurationMs, 240_000);
});

test("iOS Safari trend quantifies ten historical runs but warms the hardened gate", () => {
  const trend = buildIosSafariStabilityTrend(Array.from({ length: 10 }, (_, index) => (
    sample(index + 1, index < 7 ? "success" : index === 9 ? "cancelled" : "failure")
  )));
  assert.equal(trend.observed.sampleCount, 10);
  assert.equal(trend.observed.successRate, 0.7);
  assert.equal(trend.observed.status, "watch");
  assert.equal(trend.acceptance.status, "warming");
  assert.match(formatIosSafariStabilityMarkdown(trend), /7\/10 성공/);
});

test("iOS Safari hardened gate accepts nine of ten bounded runs", () => {
  const trend = buildIosSafariStabilityTrend(Array.from({ length: 10 }, (_, index) => (
    {
      ...sample(index + 1, index === 4 ? "failure" : "success", 3, 700_000 + index * 1_000),
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
  assert.match(formatIosSafariStabilityMarkdown(trend), /대기 p95 12초/);
  assert.match(formatIosSafariStabilityMarkdown(trend), /Appium 캐시 10\/10/);
  assert.match(formatIosSafariStabilityMarkdown(trend), /준비 p95 240초/);
  assert.deepEqual(trend.acceptance.slowestCapturePhase, { name: "landscape", p95DurationMs: 180_000 });
  assert.match(formatIosSafariStabilityMarkdown(trend), /느린 단계 landscape p95 180초/);
  assert.match(formatIosSafariStabilityMarkdown(trend), /recreate 1\/1/);
});

test("iOS Safari hardened gate rejects clustered failures", () => {
  const trend = buildIosSafariStabilityTrend(Array.from({ length: 10 }, (_, index) => (
    sample(index + 1, [7, 8].includes(index) ? "failure" : "success", 3)
  )));
  assert.equal(trend.acceptance.status, "failed");
  assert.ok(trend.acceptance.issues.some((issue) => issue.startsWith("연속 실패 2회")));
});

test("iOS Safari hardened gate reports slow setup and capture phases", () => {
  const runs = Array.from({ length: 10 }, (_, index) => ({
    ...sample(index + 1, "success", 3, 1_100_000),
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
    ...sample(index + 1, "success", 3),
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
    ...sample(index + 1, "success", 3),
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
    ...sample(index + 1, "success", 3),
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
