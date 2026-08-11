import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateReleaseWorkflowReadiness,
  releaseSummaryArtifactExists,
  requiredReleaseWorkflows
} from "./lib/releaseWorkflowGate.mjs";

const completed = (id, conclusion = "success", runAttempt = 1) => ({
  id,
  status: "completed",
  conclusion,
  run_attempt: runAttempt,
  html_url: `https://example.test/runs/${id}`
});

test("release summary waits for all four same-commit workflows", () => {
  assert.deepEqual(requiredReleaseWorkflows.map(({ id }) => id), ["pages", "mobile", "android", "ios"]);
  const waiting = evaluateReleaseWorkflowReadiness({
    pages: [completed(1)],
    mobile: [completed(2)],
    android: [{ id: 3, status: "in_progress" }],
    ios: [completed(4)]
  });
  assert.equal(waiting.ready, false);
  assert.deepEqual(waiting.pending, [{ id: "android", status: "in_progress" }]);

  const ready = evaluateReleaseWorkflowReadiness({
    pages: [completed(1)],
    mobile: [completed(2)],
    android: [completed(3, "failure", 3), completed(5, "success", 1)],
    ios: [completed(4)]
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.workflows.find(({ id }) => id === "android").runId, "5");
});

test("release summary deduplicates only a real non-expired summary artifact", () => {
  assert.equal(releaseSummaryArtifactExists([{ id: 1, artifacts: [] }]), false);
  assert.equal(releaseSummaryArtifactExists([{
    id: 2,
    artifacts: [{ name: "release-quality-summary-2", expired: true }]
  }]), false);
  assert.equal(releaseSummaryArtifactExists([{
    id: 3,
    artifacts: [{ name: "release-quality-summary-3", expired: false }]
  }]), true);
});

test("release gate ignores artifacts from cancelled coordinators", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => (
    readFile(new URL("./check-release-workflow-readiness.mjs", import.meta.url), "utf8")
  ));
  const workflow = await import("node:fs/promises").then(({ readFile }) => (
    readFile(new URL("../.github/workflows/release-quality-summary.yml", import.meta.url), "utf8")
  ));
  assert.match(source, /status === "completed" && conclusion === "success"/);
  assert.match(workflow, /hashFiles\('\.superpowers\/visual-regression\/release-quality-summary\/release-quality-summary\.json'\) != ''/);
});
