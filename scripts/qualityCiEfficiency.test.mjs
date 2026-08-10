import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildQualityCiEfficiency, formatQualityCiEfficiencyMarkdown } from "./lib/qualityCiEfficiency.mjs";

const sample = (workflow, variant, cache = true) => ({
  workflow,
  variant,
  dependencyCacheHit: cache,
  dependencySetupDurationMs: 10_000,
  buildRestored: true,
  restoreDurationMs: 20_000,
  artifactBytes: 12_000_000,
  producerBuildDurationMs: variant === "device" ? 40_000 : 120_000
});

test("quality CI dashboard aggregates cache, reuse, size, and saved time", () => {
  const summary = buildQualityCiEfficiency([
    sample("pages", "production"),
    sample("mobile", "production"),
    sample("android", "device", false),
    sample("ios", "device")
  ]);
  assert.equal(summary.status, "passed");
  assert.equal(summary.metrics.dependencyCacheHitRate, 0.75);
  assert.equal(summary.metrics.sharedBuildRestoreRate, 1);
  assert.equal(summary.metrics.estimatedSavedMs, 320_000);
  assert.match(formatQualityCiEfficiencyMarkdown(summary), /추정 절약: 320초/);
});

test("quality CI dashboard gates missing reports and local rebuild fallback", () => {
  const summary = buildQualityCiEfficiency([
    sample("pages", "production"),
    { ...sample("mobile", "production"), buildRestored: false }
  ]);
  assert.equal(summary.status, "failed");
  assert.ok(summary.issues.some((issue) => issue.startsWith("CI 효율 보고 누락")));
  assert.ok(summary.issues.some((issue) => issue.startsWith("공통 빌드 재사용")));
});

test("all expensive quality consumers publish efficiency evidence", async () => {
  for (const workflow of ["pages.yml", "visual-regression.yml", "android-chrome-visual.yml", "ios-safari-visual.yml"]) {
    const source = await readFile(new URL(`../.github/workflows/${workflow}`, import.meta.url), "utf8");
    assert.match(source, /report-quality-ci-efficiency/);
    assert.match(source, /dependency-cache-hit:/);
    assert.match(source, /producer-build-duration-ms:/);
  }
  const restoreAction = await readFile(new URL("../.github/actions/restore-quality-build/action.yml", import.meta.url), "utf8");
  assert.match(restoreAction, /artifact-bytes:/);
  assert.match(restoreAction, /producer-build-duration-ms:/);
});
