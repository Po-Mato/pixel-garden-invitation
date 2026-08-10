import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildQualityEvidenceEfficiency,
  formatQualityEvidenceEfficiencyMarkdown,
  mergeQualityEvidenceEfficiencyHistory
} from "./lib/qualityEvidenceEfficiency.mjs";

const manifest = ({ total = 10_000_000, stored = 7_000_000, files = ["game.png"] } = {}) => ({
  totals: { totalBytes: total, storedBytes: stored, omittedDuplicateBytes: total - stored },
  files: files.map((logicalPath) => ({ logicalPath }))
});
const snapshot = (index, storedBytes = 7_000_000, savingsRate = 0.3) => ({
  sha: `sha-${index}`,
  generatedAt: `2026-08-0${index}T00:00:00.000Z`,
  storedBytes,
  savingsRate
});

test("content-addressed evidence efficiency reports savings and warms its trend", () => {
  const { report } = buildQualityEvidenceEfficiency([manifest(), manifest()], {}, { sha: "current" });
  assert.equal(report.status, "warming");
  assert.equal(report.metrics.omittedDuplicateBytes, 6_000_000);
  assert.equal(report.metrics.savingsRate, 0.3);
  assert.match(formatQualityEvidenceEfficiencyMarkdown(report), /중복 절감 6000000 bytes/);
});

test("content-addressed evidence efficiency gates diff leaks and material size regressions", () => {
  const history = { version: 1, snapshots: [snapshot(1), snapshot(2), snapshot(3)] };
  const { report } = buildQualityEvidenceEfficiency([
    manifest({ total: 20_000_000, stored: 15_000_000, files: ["game-diff.png", "soak-trace.zip"] })
  ], history, { sha: "current" });
  assert.equal(report.status, "failed");
  assert.ok(report.issues.some((issue) => issue.startsWith("성공 패키지 diff/trace 누출")));
  assert.ok(report.issues.some((issue) => issue.startsWith("저장 크기 회귀")));
});

test("evidence efficiency history de-duplicates release SHA and retains order", () => {
  const history = mergeQualityEvidenceEfficiencyHistory(
    { version: 1, snapshots: [snapshot(1), snapshot(2)] },
    [{ ...snapshot(2), storedBytes: 6_000_000 }, snapshot(3)]
  );
  assert.deepEqual(history.snapshots.map(({ sha, storedBytes }) => [sha, storedBytes]), [
    ["sha-1", 7_000_000], ["sha-2", 6_000_000], ["sha-3", 7_000_000]
  ]);
});

test("release summary includes every content-addressed success package in savings", async () => {
  const workflow = await readFile(new URL("../.github/workflows/release-quality-summary.yml", import.meta.url), "utf8");
  assert.match(workflow, /production-large-text-canary/);
  assert.match(workflow, /mobile-device-soak-\$MOBILE_RUN_ID/);
  assert.match(workflow, /quality:evidence-efficiency/);
});
