import assert from "node:assert/strict";
import test from "node:test";
import { buildWorldGeometryPolicyIssue, worldGeometryPolicyIssueMarker } from "./lib/worldGeometryPolicyIssue.mjs";

const expiredItem = {
  zoneId: "lobby", action: "review-raise", owner: "@map-owner",
  firstObservedAt: "2026-08-01T00:00:00.000Z", lastSeenAt: "2026-08-09T00:00:00.000Z",
  dueAt: "2026-08-04T00:00:00.000Z", expiresAt: "2026-08-08T00:00:00.000Z", status: "expired",
  currentMaxWarnings: 0, recommendedMaxWarnings: 2
};

test("expired policy recommendations produce an owner-addressed issue request", () => {
  const request = buildWorldGeometryPolicyIssue({ version: 1, generatedAt: "2026-08-09T00:00:00.000Z", items: [expiredItem] }, { runUrl: "https://github.com/owner/repo/actions/runs/1" });
  assert.equal(request.action, "open-or-update");
  assert.equal(request.expiredCount, 1);
  assert.match(request.issue.title, /만료 권고 1개/);
  assert.match(request.issue.body, new RegExp(worldGeometryPolicyIssueMarker));
  assert.match(request.issue.body, /@map-owner/);
  assert.match(request.issue.body, /lobby/);
  assert.match(request.fingerprint, /^[a-f0-9]{64}$/);
});

test("clear governance closes a previously managed issue", () => {
  const request = buildWorldGeometryPolicyIssue({ version: 1, generatedAt: "2026-08-10T00:00:00.000Z", items: [] });
  assert.equal(request.action, "close");
  assert.equal(request.expiredCount, 0);
  assert.match(request.issue.body, /자동으로 종료/);
});

test("recomputes expiry from the current run time even when the cached status is stale", () => {
  const request = buildWorldGeometryPolicyIssue({
    version: 1,
    generatedAt: "2026-08-05T00:00:00.000Z",
    items: [{ ...expiredItem, status: "due-soon" }]
  }, { generatedAt: "2026-08-09T00:00:00.000Z" });
  assert.equal(request.action, "open-or-update");
  assert.equal(request.expiredCount, 1);
});
