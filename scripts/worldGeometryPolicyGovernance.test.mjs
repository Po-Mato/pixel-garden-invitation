import assert from "node:assert/strict";
import test from "node:test";
import { buildWorldGeometryPolicyGovernance } from "./lib/worldGeometryPolicyGovernance.mjs";

const config = { version: 1, defaultOwner: "@map-owner", reviewAfterDays: 3, expireAfterDays: 7, dueSoonDays: 1, zones: {} };
const tuning = (action = "review-raise") => ({ recommendations: [{ zoneId: "lobby", action, currentMaxWarnings: 0, recommendedMaxWarnings: 2 }] });

test("policy governance assigns an owner and review deadlines", () => {
  const result = buildWorldGeometryPolicyGovernance(tuning(), { version: 1, items: [] }, config, { generatedAt: "2026-08-01T00:00:00.000Z" });
  assert.equal(result.report.status, "tracking");
  assert.deepEqual(result.report.items[0], {
    zoneId: "lobby",
    action: "review-raise",
    owner: "@map-owner",
    firstObservedAt: "2026-08-01T00:00:00.000Z",
    lastSeenAt: "2026-08-01T00:00:00.000Z",
    dueAt: "2026-08-04T00:00:00.000Z",
    expiresAt: "2026-08-08T00:00:00.000Z",
    status: "active",
    currentMaxWarnings: 0,
    recommendedMaxWarnings: 2
  });
});

test("policy governance preserves first observation and flags overdue and expired reviews", () => {
  const previous = buildWorldGeometryPolicyGovernance(tuning(), { version: 1, items: [] }, config, { generatedAt: "2026-08-01T00:00:00.000Z" }).state;
  const overdue = buildWorldGeometryPolicyGovernance(tuning(), previous, config, { generatedAt: "2026-08-05T00:00:00.000Z" });
  assert.equal(overdue.report.items[0].status, "overdue");
  assert.equal(overdue.report.overdueCount, 1);
  const expired = buildWorldGeometryPolicyGovernance(tuning(), overdue.state, config, { generatedAt: "2026-08-09T00:00:00.000Z" });
  assert.equal(expired.report.status, "expired");
  assert.equal(expired.report.expiredCount, 1);
});

test("resolved recommendations disappear from active governance state", () => {
  const previous = buildWorldGeometryPolicyGovernance(tuning(), { version: 1, items: [] }, config, { generatedAt: "2026-08-01T00:00:00.000Z" }).state;
  const resolved = buildWorldGeometryPolicyGovernance(tuning("keep"), previous, config, { generatedAt: "2026-08-02T00:00:00.000Z" });
  assert.equal(resolved.report.status, "clear");
  assert.deepEqual(resolved.state.items, []);
});
