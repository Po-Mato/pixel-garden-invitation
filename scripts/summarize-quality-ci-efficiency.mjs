import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildQualityCiEfficiency,
  formatQualityCiEfficiencyMarkdown,
  mergeQualityCiEfficiencyHistory,
  mergeQualityCiRunTimings
} from "./lib/qualityCiEfficiency.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const inputDir = path.resolve(option("--input-dir", path.join(rootDir, "quality-inputs")));
const outputDir = path.resolve(option("--output-dir", path.join(rootDir, ".superpowers/visual-regression/release-quality-summary")));
const mirrorDir = path.resolve(option("--mirror-dir", path.join(inputDir, "automation")));
const historyPath = path.resolve(option("--history", path.join(outputDir, "quality-ci-efficiency-history.json")));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : entry.isFile() ? [target] : [];
  }))).flat();
}

const files = await filesBelow(inputDir);
const reportFiles = files.filter((file) => (
  /^quality-ci-efficiency-(?:pages|mobile|android|ios|cold-sample)\.json$/.test(path.basename(file))
));
const timingFiles = files.filter((file) => (
  /^quality-ci-run-timing-(?:pages|mobile|android|ios|cold-sample)(?:-[^.]+)?\.json$/.test(path.basename(file))
));
const [samples, timings, history] = await Promise.all([
  Promise.all(reportFiles.map((file) => readFile(file, "utf8").then(JSON.parse))),
  Promise.all(timingFiles.map((file) => readFile(file, "utf8").then(JSON.parse))),
  readFile(historyPath, "utf8").then(JSON.parse, () => ({ version: 1, samples: [] }))
]);
const mergedSamples = mergeQualityCiRunTimings(samples, timings);
const generatedAt = new Date().toISOString();
const summary = buildQualityCiEfficiency(mergedSamples, history, {
  generatedAt,
  repositoryVisibility: option("--repository-visibility", "public")
});
const nextHistory = mergeQualityCiEfficiencyHistory(history, [...summary.reports, ...summary.supplementalReports]);
const markdown = formatQualityCiEfficiencyMarkdown(summary);
await Promise.all([mkdir(outputDir, { recursive: true }), mkdir(mirrorDir, { recursive: true })]);
await Promise.all([
  writeFile(path.join(outputDir, "quality-ci-efficiency-summary.json"), `${JSON.stringify(summary, null, 2)}\n`),
  writeFile(path.join(outputDir, "quality-ci-efficiency-summary.md"), markdown),
  writeFile(path.join(mirrorDir, "quality-ci-efficiency-summary.json"), `${JSON.stringify(summary, null, 2)}\n`),
  writeFile(historyPath, `${JSON.stringify(nextHistory, null, 2)}\n`)
]);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}\n`);
console.log(`품질 CI 효율: ${summary.status} · ${summary.metrics.reportCount}/${summary.policy.expectedWorkflows.length}`);
