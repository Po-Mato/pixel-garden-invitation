import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  auditMapEvidenceDuration,
  targetedMapEvidenceBudgetMs,
  targetedMapEvidencePhaseBudgetsMs
} from "./lib/mapEvidenceDurationBudget.mjs";

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

test("targeted map evidence identifies and budgets its slowest phase", () => {
  assert.equal(targetedMapEvidencePhaseBudgetsMs["map-contracts"], 65_000);
  const report = auditMapEvidenceDuration({
    startedAtMs: 1_000,
    setupFinishedAtMs: 31_000,
    contractsFinishedAtMs: 90_000,
    diagnosticsFinishedAtMs: 103_000,
    browserSetupFinishedAtMs: 121_000,
    auditProvenanceFinishedAtMs: 160_000,
    finishedAtMs: 175_000
  });
  assert.equal(report.status, "passed");
  assert.equal(report.phases.length, 6);
  assert.deepEqual(report.slowestPhase, {
    name: "map-contracts",
    status: "passed",
    durationMs: 59_000,
    budgetMs: 65_000,
    remainingMs: 6_000
  });
});

test("targeted map evidence fails when one phase exceeds its own budget", () => {
  const report = auditMapEvidenceDuration({
    startedAtMs: 1_000,
    setupFinishedAtMs: 31_000,
    contractsFinishedAtMs: 97_000,
    diagnosticsFinishedAtMs: 110_000,
    browserSetupFinishedAtMs: 128_000,
    auditProvenanceFinishedAtMs: 167_000,
    finishedAtMs: 182_000
  });
  assert.equal(report.status, "failed");
  assert.deepEqual(report.phaseIssues, ["map-contracts 66초/65초"]);
});

test("mobile workflow measures the targeted scope from its first step and uploads the budget report", async () => {
  const workflow = await readFile(new URL("../.github/workflows/visual-regression.yml", import.meta.url), "utf8");
  assert.match(workflow, /Mark targeted map evidence start[\s\S]*MAP_EVIDENCE_STARTED_AT_MS/);
  assert.match(workflow, /check-map-evidence-duration-budget\.mjs --started-at-ms "\$MAP_EVIDENCE_STARTED_AT_MS" --budget-ms 240000/);
  assert.match(workflow, /MAP_EVIDENCE_SETUP_FINISHED_AT_MS/);
  assert.match(workflow, /MAP_EVIDENCE_CONTRACTS_FINISHED_AT_MS/);
  assert.match(workflow, /MAP_EVIDENCE_DIAGNOSTICS_FINISHED_AT_MS/);
  assert.match(workflow, /MAP_EVIDENCE_BROWSER_SETUP_FINISHED_AT_MS/);
  assert.match(workflow, /MAP_EVIDENCE_AUDIT_PROVENANCE_FINISHED_AT_MS/);
  assert.match(workflow, /map-evidence-duration-\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /run-map-approval-contracts\.mjs/);
  assert.match(workflow, /map-approval-contracts-duration\.json/);
});
