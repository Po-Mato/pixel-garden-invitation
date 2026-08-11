import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditMapEvidenceDuration, targetedMapEvidenceBudgetMs } from "./lib/mapEvidenceDurationBudget.mjs";

test("targeted map evidence passes inside the 240 second budget", () => {
  assert.equal(targetedMapEvidenceBudgetMs, 240_000);
  assert.deepEqual(auditMapEvidenceDuration({ startedAtMs: 1_000, finishedAtMs: 240_000 }), {
    status: "passed",
    startedAtMs: 1_000,
    finishedAtMs: 240_000,
    durationMs: 239_000,
    budgetMs: 240_000,
    remainingMs: 1_000
  });
});

test("targeted map evidence fails beyond the hard budget", () => {
  const report = auditMapEvidenceDuration({ startedAtMs: 1_000, finishedAtMs: 241_001 });
  assert.equal(report.status, "failed");
  assert.equal(report.remainingMs, -1);
  assert.throws(() => auditMapEvidenceDuration({ startedAtMs: 0 }), /시작 시각/);
});

test("mobile workflow measures the targeted scope from its first step and uploads the budget report", async () => {
  const workflow = await readFile(new URL("../.github/workflows/visual-regression.yml", import.meta.url), "utf8");
  assert.match(workflow, /Mark targeted map evidence start[\s\S]*MAP_EVIDENCE_STARTED_AT_MS/);
  assert.match(workflow, /check-map-evidence-duration-budget\.mjs --started-at-ms "\$MAP_EVIDENCE_STARTED_AT_MS" --budget-ms 240000/);
  assert.match(workflow, /map-evidence-duration-\$\{\{ github\.run_id \}\}/);
});
