import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildQualityCiEfficiency, formatQualityCiEfficiencyMarkdown } from "./lib/qualityCiEfficiency.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const inputDir = path.resolve(option("--input-dir", path.join(rootDir, "quality-inputs")));
const outputDir = path.resolve(option("--output-dir", path.join(rootDir, ".superpowers/visual-regression/release-quality-summary")));
const mirrorDir = path.resolve(option("--mirror-dir", path.join(inputDir, "automation")));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : entry.isFile() ? [target] : [];
  }))).flat();
}

const reportFiles = (await filesBelow(inputDir)).filter((file) => (
  /^quality-ci-efficiency-(?:pages|mobile|android|ios)\.json$/.test(path.basename(file))
));
const samples = await Promise.all(reportFiles.map((file) => readFile(file, "utf8").then(JSON.parse)));
const summary = buildQualityCiEfficiency(samples);
const markdown = formatQualityCiEfficiencyMarkdown(summary);
await Promise.all([mkdir(outputDir, { recursive: true }), mkdir(mirrorDir, { recursive: true })]);
await Promise.all([
  writeFile(path.join(outputDir, "quality-ci-efficiency-summary.json"), `${JSON.stringify(summary, null, 2)}\n`),
  writeFile(path.join(outputDir, "quality-ci-efficiency-summary.md"), markdown),
  writeFile(path.join(mirrorDir, "quality-ci-efficiency-summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
]);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}\n`);
console.log(`품질 CI 효율: ${summary.status} · ${summary.metrics.reportCount}/${summary.policy.expectedWorkflows.length}`);
