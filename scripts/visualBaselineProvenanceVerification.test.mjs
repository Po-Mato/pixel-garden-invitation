import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { visualBaselineArtifactSha256 } from "./lib/visualBaselineProvenance.mjs";
import {
  auditVisualBaselineProvenance,
  verifyVisualBaselineProvenance
} from "./lib/visualBaselineProvenanceVerification.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function currentMetadata() {
  const files = [{ logicalPath: "capture/game", size: 321, sha256: "b".repeat(64) }];
  return {
    version: 3,
    capture: { runId: "123", sha: "a".repeat(40) },
    provenance: {
      schemaVersion: 1,
      sourceKind: "github-actions",
      runId: "123",
      runAttempt: 1,
      commitSha: "a".repeat(40),
      runUrl: "https://github.com/owner/repo/actions/runs/123",
      checksumAlgorithm: "sha256",
      artifactChecksumScope: "sorted-capture-set-manifest",
      artifactSha256: visualBaselineArtifactSha256(files),
      files
    }
  };
}

test("current-schema provenance binds a sorted capture manifest to its run and commit", () => {
  assert.deepEqual(auditVisualBaselineProvenance(currentMetadata(), 3), []);
});

test("provenance verification rejects a tampered artifact checksum", () => {
  const metadata = currentMetadata();
  metadata.provenance.artifactSha256 = "0".repeat(64);
  assert.ok(auditVisualBaselineProvenance(metadata, 3).includes(
    "provenance artifactSha256 does not match its capture manifest"
  ));
});

test("provenance verification rejects capture run and commit mismatches", () => {
  const metadata = currentMetadata();
  metadata.capture = { runId: "456", sha: "c".repeat(40) };
  assert.deepEqual(auditVisualBaselineProvenance(metadata, 3).filter((issue) => issue.includes("does not match")), [
    "provenance runId does not match capture runId",
    "provenance commitSha does not match capture SHA"
  ]);
});

test("committed legacy baselines retain valid file checksums", async () => {
  const result = await verifyVisualBaselineProvenance({ rootDir });
  assert.equal(result.passed, true, result.issues.join("\n"));
  assert.deepEqual(result.summaries.map(({ id, status }) => [id, status]), [
    ["ios-safari", "legacy"],
    ["android-chrome", "legacy"],
    ["mobile-device", "legacy"],
    ["mobile-game", "legacy"]
  ]);
});

test("shared build and approval workflows gate baseline provenance", async () => {
  const [qualityWorkflow, approvalWorkflow, packageSource] = await Promise.all([
    readFile(path.join(rootDir, ".github/workflows/quality-build.yml"), "utf8"),
    readFile(path.join(rootDir, ".github/workflows/visual-baseline-approval.yml"), "utf8"),
    readFile(path.join(rootDir, "package.json"), "utf8")
  ]);
  assert.match(qualityWorkflow, /run: pnpm visual:provenance:verify/);
  assert.match(approvalWorkflow, /name: Verify approved baseline provenance\s+run: pnpm visual:provenance:verify/);
  const packageJson = JSON.parse(packageSource);
  assert.equal(packageJson.scripts["visual:provenance:verify"], "node scripts/verify-visual-baseline-provenance.mjs");
  assert.match(packageJson.scripts["visual:test"], /visualBaselineProvenanceVerification\.test\.mjs/);
});
