import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyVisualDifference,
  summarizeVisualDifferenceClassifications,
  visualDiffClassifications
} from "./lib/visualDiffClassifier.mjs";

test("visual difference classifier separates renderer noise from structural change", () => {
  const noise = classifyVisualDifference({
    passed: true,
    changedRatio: 0.001,
    rawChangedRatio: 0.008,
    maxChangedRatio: 0.015
  });
  const structural = classifyVisualDifference({
    passed: false,
    changedRatio: 0.02,
    rawChangedRatio: 0.021,
    maxChangedRatio: 0.015
  });

  assert.equal(noise.id, visualDiffClassifications.rendererNoise);
  assert.equal(noise.review, "not-required");
  assert.ok(noise.filteredNoiseShare > 0.8);
  assert.equal(structural.id, visualDiffClassifications.structuralRegression);
  assert.equal(structural.review, "required");
});

test("visual difference classifier only labels explicit baseline approvals as intentional", () => {
  const unapproved = classifyVisualDifference({ passed: true, changedRatio: 0.012, maxChangedRatio: 0.015 });
  const approved = classifyVisualDifference(
    { passed: true, changedRatio: 0.012, maxChangedRatio: 0.015 },
    { approved: true, reason: "모바일 플로팅 안내 축소" }
  );

  assert.equal(unapproved.id, visualDiffClassifications.watchStructural);
  assert.equal(approved.id, visualDiffClassifications.intentionalBaselineUpdate);
  assert.equal(approved.approvalReason, "모바일 플로팅 안내 축소");
});

test("visual difference summary preserves source and exposes review status", () => {
  const summary = summarizeVisualDifferenceClassifications([
    { source: "android", state: "game", passed: true, changedRatio: 0, maxChangedRatio: 0.015 },
    { source: "ios", state: "game", passed: false, changedRatio: 0.02, maxChangedRatio: 0.015 }
  ]);

  assert.equal(summary.status, "failed");
  assert.equal(summary.counts[visualDiffClassifications.stable], 1);
  assert.equal(summary.counts[visualDiffClassifications.structuralRegression], 1);
  assert.deepEqual(summary.details.map(({ source, state }) => [source, state]), [["android", "game"], ["ios", "game"]]);
});
