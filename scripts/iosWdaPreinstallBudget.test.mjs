import assert from "node:assert/strict";
import test from "node:test";
import { auditIosWdaPreinstall, iosWdaPreinstallBudgetMs } from "./lib/iosWdaPreinstallBudget.mjs";

test("WDA preinstall stays inside the sustained 40 second budget", () => {
  assert.equal(iosWdaPreinstallBudgetMs, 40_000);
  assert.deepEqual(auditIosWdaPreinstall({
    durationMs: 33_423,
    sourceBytes: 12_000_000,
    installBytes: 3_000_000
  }), {
    status: "passed",
    durationMs: 33_423,
    budgetMs: 40_000,
    remainingMs: 6_577,
    sourceBytes: 12_000_000,
    installBytes: 3_000_000,
    savedBytes: 9_000_000,
    reductionRatio: 0.75
  });
});

test("WDA preinstall fails above the hard budget", () => {
  const report = auditIosWdaPreinstall({ durationMs: 40_001 });
  assert.equal(report.status, "failed");
  assert.equal(report.remainingMs, -1);
  assert.throws(() => auditIosWdaPreinstall({ durationMs: -1 }), /선설치 시간/);
});
