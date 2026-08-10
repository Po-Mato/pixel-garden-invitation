import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedReleaseQualityHistory } from "./lib/releaseQualityTrend.mjs";
import { seedVisualDiffCalibrationHistory } from "./lib/visualDiffCalibration.mjs";
import { mergeQualityCiEfficiencyHistory } from "./lib/qualityCiEfficiency.mjs";
import { mergeQualityEvidenceEfficiencyHistory } from "./lib/qualityEvidenceEfficiency.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const inputDir = path.resolve(option("--input-dir", path.join(rootDir, ".superpowers/visual-regression/release-quality-seed")));
const historyPath = path.resolve(option(
  "--history",
  path.join(rootDir, ".superpowers/visual-regression/release-quality-summary/release-quality-history.json")
));
const calibrationHistoryPath = path.resolve(option(
  "--calibration-history",
  path.join(rootDir, ".superpowers/visual-regression/release-quality-summary/visual-diff-calibration-history.json")
));
const ciHistoryPath = path.resolve(option(
  "--ci-history",
  path.join(rootDir, ".superpowers/visual-regression/release-quality-summary/quality-ci-efficiency-history.json")
));
const evidenceHistoryPath = path.resolve(option(
  "--evidence-history",
  path.join(rootDir, ".superpowers/visual-regression/release-quality-summary/quality-evidence-efficiency-history.json")
));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const children = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(entryPath) : [entryPath];
  }));
  return children.flat();
}

const files = await filesBelow(inputDir);
const summaryPaths = files.filter((filePath) => path.basename(filePath) === "release-quality-summary.json");
const summaries = await Promise.all(summaryPaths.map((filePath) => readFile(filePath, "utf8").then(JSON.parse)));
const currentHistory = await readFile(historyPath, "utf8").then(JSON.parse, () => ({ version: 1, snapshots: [] }));
const seeded = seedReleaseQualityHistory(currentHistory, summaries);
const currentCalibrationHistory = await readFile(calibrationHistoryPath, "utf8")
  .then(JSON.parse, () => ({ version: 1, snapshots: [] }));
const seededCalibration = seedVisualDiffCalibrationHistory(currentCalibrationHistory, summaries);
const ciHistoryFiles = files.filter((filePath) => path.basename(filePath) === "quality-ci-efficiency-history.json");
const ciSummaryFiles = files.filter((filePath) => path.basename(filePath) === "quality-ci-efficiency-summary.json");
const [ciHistories, ciSummaries, currentCiHistory] = await Promise.all([
  Promise.all(ciHistoryFiles.map((filePath) => readFile(filePath, "utf8").then(JSON.parse))),
  Promise.all(ciSummaryFiles.map((filePath) => readFile(filePath, "utf8").then(JSON.parse))),
  readFile(ciHistoryPath, "utf8").then(JSON.parse, () => ({ version: 1, samples: [] }))
]);
const seededCiHistory = mergeQualityCiEfficiencyHistory(currentCiHistory, [
  ...ciHistories.flatMap(({ samples }) => samples ?? []),
  ...ciSummaries.flatMap(({ reports }) => reports ?? [])
]);
const evidenceHistoryFiles = files.filter((filePath) => path.basename(filePath) === "quality-evidence-efficiency-history.json");
const evidenceSummaryFiles = files.filter((filePath) => path.basename(filePath) === "quality-evidence-efficiency-summary.json");
const [evidenceHistories, evidenceSummaries, currentEvidenceHistory] = await Promise.all([
  Promise.all(evidenceHistoryFiles.map((filePath) => readFile(filePath, "utf8").then(JSON.parse))),
  Promise.all(evidenceSummaryFiles.map((filePath) => readFile(filePath, "utf8").then(JSON.parse))),
  readFile(evidenceHistoryPath, "utf8").then(JSON.parse, () => ({ version: 1, snapshots: [] }))
]);
const seededEvidenceHistory = mergeQualityEvidenceEfficiencyHistory(currentEvidenceHistory, [
  ...evidenceHistories.flatMap(({ snapshots }) => snapshots ?? []),
  ...evidenceSummaries.flatMap((summary) => summary?.metrics?.sha || summary?.sha ? [{
    ...summary.metrics,
    sha: summary.metrics?.sha ?? summary.sha,
    generatedAt: summary.metrics?.generatedAt ?? summary.generatedAt
  }] : [])
]);
await Promise.all([
  mkdir(path.dirname(historyPath), { recursive: true }),
  mkdir(path.dirname(calibrationHistoryPath), { recursive: true }),
  mkdir(path.dirname(ciHistoryPath), { recursive: true }),
  mkdir(path.dirname(evidenceHistoryPath), { recursive: true })
]);
await Promise.all([
  writeFile(historyPath, `${JSON.stringify(seeded, null, 2)}\n`),
  writeFile(calibrationHistoryPath, `${JSON.stringify(seededCalibration, null, 2)}\n`),
  writeFile(ciHistoryPath, `${JSON.stringify(seededCiHistory, null, 2)}\n`),
  writeFile(evidenceHistoryPath, `${JSON.stringify(seededEvidenceHistory, null, 2)}\n`)
]);
console.log(`릴리스 품질 이력 시드: ${seeded.snapshots.length}개 · 엔진 보정 ${seededCalibration.snapshots.length}개 · CI ${seededCiHistory.samples.length}개 · 증거 ${seededEvidenceHistory.snapshots.length}개`);
