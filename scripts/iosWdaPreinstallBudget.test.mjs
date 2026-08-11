import assert from "node:assert/strict";
import test from "node:test";
import {
  auditIosWdaPreinstall,
  iosWdaPreinstallBudgetMs,
  iosWdaPreinstallHardLimitMs
} from "./lib/iosWdaPreinstallBudget.mjs";

test("WDA preinstall stays inside the sustained 40 second budget", () => {
  assert.equal(iosWdaPreinstallBudgetMs, 40_000);
  assert.equal(iosWdaPreinstallHardLimitMs, 120_000);
  assert.deepEqual(auditIosWdaPreinstall({
    durationMs: 33_423,
    sourceBytes: 12_000_000,
    installBytes: 3_000_000
  }), {
    status: "passed",
    targetMet: true,
    durationMs: 33_423,
    budgetMs: 40_000,
    hardLimitMs: 120_000,
    remainingMs: 6_577,
    sourceBytes: 12_000_000,
    installBytes: 3_000_000,
    savedBytes: 9_000_000,
    reductionRatio: 0.75
  });
});

test("WDA preinstall reports runner variance above target without failing below the hard limit", () => {
  const report = auditIosWdaPreinstall({ durationMs: 70_715 });
  assert.equal(report.status, "watch");
  assert.equal(report.targetMet, false);
  assert.equal(report.remainingMs, -30_715);
});

test("WDA preinstall fails above the hard limit", () => {
  const report = auditIosWdaPreinstall({ durationMs: 120_001 });
  assert.equal(report.status, "failed");
  assert.equal(report.remainingMs, -80_001);
  assert.throws(() => auditIosWdaPreinstall({ durationMs: -1 }), /선설치 시간/);
});
