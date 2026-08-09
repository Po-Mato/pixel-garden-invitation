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
    generatedAt: `2026-08-${String(index).padStart(2, "0")}T00:00:00.000Z`, policyRevision
  };
}

test("iOS Safari history replaces rerun attempts by run identity", () => {
  const merged = mergeIosSafariStabilityHistory([
    sample(1, "failure"), sample(2)
  ], [{ ...sample(1), outcome: "success" }]);
  assert.deepEqual(merged.map(({ runId, outcome }) => [runId, outcome]), [
    ["1", "success"], ["2", "success"]
  ]);
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
    sample(index + 1, index === 4 ? "failure" : "success", 1, 700_000 + index * 1_000)
  )));
  assert.equal(trend.acceptance.sampleCount, 10);
  assert.equal(trend.acceptance.status, "passed");
  assert.equal(trend.acceptance.successRate, 0.9);
});

test("iOS Safari hardened gate rejects clustered failures", () => {
  const trend = buildIosSafariStabilityTrend(Array.from({ length: 10 }, (_, index) => (
    sample(index + 1, [7, 8].includes(index) ? "failure" : "success", 1)
  )));
  assert.equal(trend.acceptance.status, "failed");
  assert.ok(trend.acceptance.issues.some((issue) => issue.startsWith("연속 실패 2회")));
});
