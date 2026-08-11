import assert from "node:assert/strict";
import test from "node:test";
import {
  auditIosWdaPreinstall,
  iosWdaPreinstallBudgetMs,
  iosWdaPreinstallHardLimitMs,
  iosWdaPreinstallMedianSampleCount
} from "./lib/iosWdaPreinstallBudget.mjs";

test("WDA preinstall stays inside the sustained 40 second budget", () => {
  assert.equal(iosWdaPreinstallBudgetMs, 40_000);
  assert.equal(iosWdaPreinstallHardLimitMs, 120_000);
  assert.equal(iosWdaPreinstallMedianSampleCount, 3);
  const report = auditIosWdaPreinstall({
    durationMs: 33_423,
    sourceBytes: 12_000_000,
    installBytes: 3_000_000
  });
  assert.equal(report.status, "passed");
  assert.equal(report.targetMet, true);
  assert.equal(report.measurementStatus, "warming");
  assert.deepEqual(report.sampleDurationsMs, [33_423]);
  assert.equal(report.remainingMs, 6_577);
  assert.equal(report.savedBytes, 9_000_000);
  assert.equal(report.reductionRatio, 0.75);
});

test("WDA preinstall reports runner variance above target without failing below the hard limit", () => {
  const report = auditIosWdaPreinstall({ durationMs: 70_715 });
  assert.equal(report.status, "watch");
  assert.equal(report.targetMet, false);
  assert.equal(report.remainingMs, -30_715);
});

test("WDA preinstall evaluates the recent three-run median while retaining the current hard limit", () => {
  const report = auditIosWdaPreinstall({
    durationMs: 98_186,
    previousDurationsMs: [38_000, 39_000, 120_000]
  });
  assert.equal(report.measurementStatus, "active");
  assert.deepEqual(report.sampleDurationsMs, [39_000, 120_000, 98_186]);
  assert.equal(report.medianDurationMs, 98_186);
  assert.equal(report.targetDurationMs, 98_186);
  assert.equal(report.status, "watch");
});

test("WDA preinstall can pass the sustained target despite one slow current runner sample", () => {
  const report = auditIosWdaPreinstall({
    durationMs: 75_000,
    previousDurationsMs: [32_000, 36_000]
  });
  assert.equal(report.medianDurationMs, 36_000);
  assert.equal(report.targetMet, true);
  assert.equal(report.status, "passed");
});

test("WDA preinstall fails above the hard limit", () => {
  const report = auditIosWdaPreinstall({ durationMs: 120_001 });
  assert.equal(report.status, "failed");
  assert.equal(report.remainingMs, -80_001);
  assert.throws(() => auditIosWdaPreinstall({ durationMs: -1 }), /선설치 시간/);
});
