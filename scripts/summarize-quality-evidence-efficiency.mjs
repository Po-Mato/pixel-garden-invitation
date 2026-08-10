import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildQualityEvidenceEfficiency,
  formatQualityEvidenceEfficiencyMarkdown
} from "./lib/qualityEvidenceEfficiency.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const inputDir = path.resolve(option("--input-dir", path.join(rootDir, "quality-inputs")));
const outputDir = path.resolve(option("--output-dir", path.join(rootDir, ".superpowers/visual-regression/release-quality-summary")));
const mirrorDir = path.resolve(option("--mirror-dir", path.join(inputDir, "automation")));
const historyPath = path.resolve(option("--history", path.join(outputDir, "quality-evidence-efficiency-history.json")));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : entry.isFile() ? [target] : [];
  }))).flat();
}

const manifestFiles = (await filesBelow(inputDir)).filter((file) => path.basename(file) === "quality-evidence-index.json");
const manifests = await Promise.all(manifestFiles.map((file) => readFile(file, "utf8").then(JSON.parse)));
const history = await readFile(historyPath, "utf8").then(JSON.parse, () => ({ version: 1, snapshots: [] }));
const result = buildQualityEvidenceEfficiency(manifests, history, {
  sha: option("--sha", process.env.GITHUB_SHA ?? null),
  generatedAt: new Date().toISOString()
});
const markdown = formatQualityEvidenceEfficiencyMarkdown(result.report);
await Promise.all([mkdir(outputDir, { recursive: true }), mkdir(mirrorDir, { recursive: true })]);
await Promise.all([
  writeFile(path.join(outputDir, "quality-evidence-efficiency-summary.json"), `${JSON.stringify(result.report, null, 2)}\n`),
  writeFile(path.join(outputDir, "quality-evidence-efficiency-summary.md"), markdown),
  writeFile(path.join(mirrorDir, "quality-evidence-efficiency-summary.json"), `${JSON.stringify(result.report, null, 2)}\n`),
  writeFile(historyPath, `${JSON.stringify(result.history, null, 2)}\n`)
]);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}\n`);
console.log(`품질 증거 저장 효율: ${result.report.status} · ${result.report.metrics.storedBytes} bytes`);
