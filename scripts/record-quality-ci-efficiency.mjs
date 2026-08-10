import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const workflow = option("--workflow", "unknown");
const outputDir = path.resolve(option("--output-dir", path.join(rootDir, ".quality-ci-efficiency")));
const fallbackStartedAtMs = Math.max(0, Number(option("--fallback-started-at-ms", 0)) || 0);
const runDurationMs = Math.max(0, Number(option("--run-duration-ms", 0)) || 0);
const sample = {
  version: 1,
  workflow,
  sampleKind: option("--sample-kind", "natural"),
  variant: option("--variant", "production"),
  dependencyCacheHit: option("--dependency-cache-hit", "false") === "true",
  dependencySetupDurationMs: Number(option("--dependency-setup-duration-ms", 0)),
  buildRestored: option("--build-restored", "false") === "true",
  restoreDurationMs: Number(option("--restore-duration-ms", 0)),
  artifactBytes: Number(option("--artifact-bytes", 0)),
  producerBuildDurationMs: Number(option("--producer-build-duration-ms", 0)),
  fallbackBuildDurationMs: fallbackStartedAtMs > 0 ? Math.max(0, Date.now() - fallbackStartedAtMs) : 0,
  runDurationMs,
  billedMinutes: runDurationMs > 0 ? Math.ceil(runDurationMs / 60_000) : 0,
  runId: process.env.GITHUB_RUN_ID ?? null,
  sha: process.env.GITHUB_SHA ?? null,
  releaseSha: option("--release-sha", process.env.GITHUB_SHA ?? null),
  generatedAt: new Date().toISOString()
};
await mkdir(outputDir, { recursive: true });
const reportPath = path.join(outputDir, `quality-ci-efficiency-${workflow}.json`);
await writeFile(reportPath, `${JSON.stringify(sample, null, 2)}\n`);
console.log(`품질 CI 효율 표본: ${workflow} · cache ${sample.dependencyCacheHit} · shared build ${sample.buildRestored}`);
