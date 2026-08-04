import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorldGeometryPolicyTrend,
  renderWorldGeometryPolicyTrendHtml
} from "./lib/worldGeometryPolicyTrend.mjs";

function current(warningCount = 0, maxWarnings = 0, blockingCount = 0) {
  return { version: 1, zones: [{ zoneId: "lobby", policy: { status: blockingCount ? "blocked" : "passed", blockingCount, warningCount, maxWarnings, violations: [] }, findings: [] }] };
}

test("policy tuning keeps thresholds until enough history exists", () => {
  const result = buildWorldGeometryPolicyTrend(current(), { version: 1, snapshots: [] }, { sha: "a", generatedAt: "2026-08-04T00:00:00Z" });
  assert.equal(result.report.status, "stable");
  assert.equal(result.report.recommendations[0].action, "keep");
  assert.match(renderWorldGeometryPolicyTrendHtml(result.history, result.report), /POLICY TUNING TRACE/);
});

test("policy tuning recommends review for repeated warnings without mutating policy", () => {
  let history = { version: 1, snapshots: [] };
  for (let index = 0; index < 5; index += 1) {
    history = buildWorldGeometryPolicyTrend(current(2), history, { sha: String(index) }).history;
  }
  const result = buildWorldGeometryPolicyTrend(current(2), history, { sha: "latest" });
  assert.equal(result.report.recommendations[0].action, "review-raise");
  assert.equal(result.report.recommendations[0].recommendedMaxWarnings, 2);
});

test("policy tuning recommends tightening an unused allowance after five snapshots", () => {
  let history = { version: 1, snapshots: [] };
  for (let index = 0; index < 4; index += 1) history = buildWorldGeometryPolicyTrend(current(0, 2), history, { sha: String(index) }).history;
  const result = buildWorldGeometryPolicyTrend(current(0, 2), history, { sha: "latest" });
  assert.equal(result.report.recommendations[0].action, "review-tighten");
  assert.equal(result.report.recommendations[0].recommendedMaxWarnings, 0);
});
