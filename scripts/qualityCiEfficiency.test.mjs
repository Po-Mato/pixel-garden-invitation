import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildQualityCiEfficiency,
  formatQualityCiEfficiencyMarkdown,
  mergeQualityCiEfficiencyHistory,
  mergeQualityCiRunTimings
} from "./lib/qualityCiEfficiency.mjs";

const sample = (workflow, variant, cache = true) => ({
  workflow,
  variant,
  dependencyCacheHit: cache,
  dependencySetupDurationMs: 10_000,
  buildRestored: true,
  restoreDurationMs: 20_000,
  artifactBytes: 12_000_000,
  producerBuildDurationMs: variant === "device" ? 40_000 : 120_000,
  runDurationMs: workflow === "ios" ? 600_000 : 120_000,
  billedMinutes: workflow === "ios" ? 10 : 2,
  runnerOs: workflow === "ios" ? "macos" : "linux",
  runId: `run-${workflow}`,
  generatedAt: "2026-08-10T00:00:00.000Z"
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
  assert.equal(summary.trend.cacheTiming.warm.p95RunDurationMs, 600_000);
  assert.equal(summary.trend.cacheTiming.cold.confidence, "warming");
  assert.equal(summary.trend.monthly.estimatedChargeUsd, 0);
  assert.equal(summary.trend.monthly.billedEquivalentUsd, 0.656);
  assert.match(formatQualityCiEfficiencyMarkdown(summary), /추정 절약: 320초/);
  assert.match(formatQualityCiEfficiencyMarkdown(summary), /공개 저장소 예상 과금 \$0\.00/);
});

test("intentional monthly cold samples improve timing confidence without replacing release reports", () => {
  const releaseSamples = [
    sample("pages", "production"),
    sample("mobile", "production"),
    sample("android", "device"),
    sample("ios", "device")
  ];
  const coldSamples = Array.from({ length: 6 }, (_, index) => ({
    ...sample("cold-sample", "production", false),
    sampleKind: "intentional-cold",
    runId: `cold-${index}`,
    dependencySetupDurationMs: 24_000 + index,
    runDurationMs: 180_000 + index
  }));
  const summary = buildQualityCiEfficiency([...releaseSamples, ...coldSamples]);
  assert.equal(summary.metrics.reportCount, 4);
  assert.equal(summary.reports.length, 4);
  assert.equal(summary.supplementalReports.length, 6);
  assert.equal(summary.trend.cacheTiming.cold.sampleCount, 6);
  assert.equal(summary.trend.cacheTiming.cold.intentionalSampleCount, 6);
  assert.equal(summary.trend.cacheTiming.cold.confidence, "established");
  assert.match(formatQualityCiEfficiencyMarkdown(summary), /의도 표본 6회, 신뢰도 established/);
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
  const buildWorkflow = await readFile(new URL("../.github/workflows/quality-build.yml", import.meta.url), "utf8");
  assert.match(buildWorkflow, /cron: "23 5 1 \* \*"/);
  assert.match(buildWorkflow, /force_cold_sample:/);
  assert.match(buildWorkflow, /inputs\.force_cold_sample == true/);
  assert.match(buildWorkflow, /force-cold:/);
  assert.match(buildWorkflow, /quality-ci-intentional-cold-/);
  const dependencyAction = await readFile(new URL("../.github/actions/setup-quality-dependencies/action.yml", import.meta.url), "utf8");
  assert.match(dependencyAction, /hashFiles\('pnpm-lock\.yaml'\)/);
  assert.doesNotMatch(dependencyAction, /hashFiles\('pnpm-lock\.yaml',/);
});

test("quality CI history separates cold and warm p50/p95 without double-counting reruns", () => {
  const current = [
    { ...sample("pages", "production", true), runId: "2", dependencySetupDurationMs: 8_000, runDurationMs: 100_000 },
    { ...sample("ios", "device", true), runId: "3", dependencySetupDurationMs: 20_000, runDurationMs: 600_000 }
  ];
  const history = mergeQualityCiEfficiencyHistory({ version: 1, samples: [
    { ...sample("pages", "production", false), runId: "1", dependencySetupDurationMs: 30_000, runDurationMs: 180_000 },
    { ...sample("pages", "production", true), runId: "2", dependencySetupDurationMs: 9_000, runDurationMs: 110_000 }
  ] }, current);
  assert.equal(history.samples.length, 3);
  const summary = buildQualityCiEfficiency(current, history, {
    generatedAt: "2026-08-10T12:00:00.000Z",
    repositoryVisibility: "private"
  });
  assert.equal(summary.trend.cacheTiming.cold.p50SetupDurationMs, 30_000);
  assert.equal(summary.trend.cacheTiming.warm.p50SetupDurationMs, 8_000);
  assert.equal(summary.trend.cacheTiming.warm.p95RunDurationMs, 600_000);
  assert.ok(summary.trend.monthly.estimatedChargeUsd > 0);
});

test("quality CI timing reports merge only with their matching workflow run", () => {
  const samples = [{ ...sample("pages", "production"), runId: "42", runDurationMs: 0 }];
  const merged = mergeQualityCiRunTimings(samples, [{
    workflow: "pages", runId: "42", runDurationMs: 123_000, billedMinutes: 3, runnerOs: "linux"
  }]);
  assert.equal(merged[0].runDurationMs, 123_000);
  assert.equal(merged[0].billedMinutes, 3);
});
