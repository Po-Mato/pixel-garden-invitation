import assert from "node:assert/strict";
import test from "node:test";
import {
  createQualityArtifactManifest,
  formatQualityArtifactManifestMarkdown,
  qualityArtifactRetentionClass
} from "./lib/qualityArtifactManifest.mjs";

test("quality artifact manifest binds checksums and identifies duplicate bytes", () => {
  const manifest = createQualityArtifactManifest([
    { path: "android/game-current.png", size: 100, sha256: "a".repeat(64) },
    { path: "ios/game-current.png", size: 100, sha256: "a".repeat(64) },
    { path: "summary/report.json", size: 20, sha256: "b".repeat(64) }
  ], "2026-08-10T00:00:00.000Z");

  assert.deepEqual(manifest.totals, {
    files: 3,
    uniqueFiles: 2,
    duplicateFiles: 1,
    totalBytes: 220,
    uniqueBytes: 120,
    duplicateBytes: 100
  });
  assert.equal(manifest.files[1].duplicateOf, "android/game-current.png");
  assert.match(formatQualityArtifactManifestMarkdown(manifest), /중복 절감 후보: 100 bytes/);
});

test("quality artifact retention separates metadata, success evidence, and failure diffs", () => {
  assert.equal(qualityArtifactRetentionClass("report.json"), "metadata-30d");
  assert.equal(qualityArtifactRetentionClass("game-current.png"), "visual-evidence-7d");
  assert.equal(qualityArtifactRetentionClass("game-diff.png"), "failure-diff-14d");
  assert.equal(qualityArtifactRetentionClass("runner.log"), "diagnostic-log-7d");
});
