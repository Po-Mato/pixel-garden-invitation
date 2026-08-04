import assert from "node:assert/strict";
import test from "node:test";
import { buildWorldGeometryPolicyPrSummary } from "./lib/worldGeometryPolicyPrSummary.mjs";

const report = {
  snapshotCount: 6,
  recommendations: [
    { zoneId: "home", action: "keep", currentMaxWarnings: 0, recommendedMaxWarnings: 0, p90Warnings: 0, warningRunRate: 0, blockingRuns: 0 },
    { zoneId: "ceremony-hall", action: "review-tighten", currentMaxWarnings: 1, recommendedMaxWarnings: 0, p90Warnings: 0, warningRunRate: 0, blockingRuns: 0 }
  ]
};

test("policy PR summary waits for an explicit approval label", () => {
  const result = buildWorldGeometryPolicyPrSummary(report, { runUrl: "https://example.test/run" });
  assert.equal(result.approvalStatus, "awaiting-approval");
  assert.equal(result.reviewCount, 1);
  assert.match(result.markdown, /geometry-policy-approved/);
  assert.match(result.markdown, /`ceremony-hall`/);
  assert.match(result.markdown, /정책 보고서·이력·튜닝 HTML/);
});

test("policy PR summary records manual approval without mutating policy", () => {
  const result = buildWorldGeometryPolicyPrSummary(report, { approved: true });
  assert.equal(result.approvalStatus, "approved");
  assert.match(result.markdown, /수동 검토 승인이 기록/);
  assert.match(result.markdown, /자동 변경하지 않습니다/);
});

test("stable policy does not require manual approval", () => {
  const result = buildWorldGeometryPolicyPrSummary({ snapshotCount: 3, recommendations: [report.recommendations[0]] });
  assert.equal(result.approvalStatus, "not-required");
  assert.equal(result.reviewCount, 0);
});

test("policy summary exposes owner, due date, and stale review state", () => {
  const result = buildWorldGeometryPolicyPrSummary({
    snapshotCount: 7,
    recommendations: [{ zoneId: "lobby", action: "review-raise", currentMaxWarnings: 0, recommendedMaxWarnings: 2, p90Warnings: 2, warningRunRate: 0.7, blockingRuns: 0 }]
  }, {
    governance: {
      expiredCount: 0,
      overdueCount: 1,
      items: [{ zoneId: "lobby", owner: "@map-owner", status: "overdue", dueAt: "2026-08-04T00:00:00.000Z", expiresAt: "2026-08-10T00:00:00.000Z" }]
    }
  });
  assert.match(result.markdown, /@map-owner/);
  assert.match(result.markdown, /overdue.*2026-08-04.*2026-08-10/);
  assert.match(result.markdown, /기한 초과 \*\*1개\*\*/);
});
