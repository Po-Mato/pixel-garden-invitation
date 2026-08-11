import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReleaseQualitySummary,
  formatReleaseQualitySummaryMarkdown,
  releaseQualityEvidenceNames
} from "./lib/releaseQualitySummary.mjs";
import { buildReleaseQualityTrend } from "./lib/releaseQualityTrend.mjs";
import { buildVisualDiffCalibration } from "./lib/visualDiffCalibration.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const inputDir = path.resolve(option("--input-dir", path.join(rootDir, ".superpowers/visual-regression")));
const outputDir = path.resolve(option("--output-dir", path.join(rootDir, ".superpowers/visual-regression/release-quality-summary")));
const historyPath = path.resolve(option("--history", path.join(outputDir, "release-quality-history.json")));
const calibrationHistoryPath = path.resolve(option(
  "--calibration-history",
  path.join(outputDir, "visual-diff-calibration-history.json")
));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(entryPath) : [entryPath];
  }));
  return nested.flat();
}

const files = await filesBelow(inputDir);
async function readEvidence(filename) {
  const candidates = files
    .filter((file) => path.basename(file) === filename && !file.includes("baseline-approval"))
    .sort((left, right) => left.length - right.length);
  if (candidates.length === 0) return null;
  return JSON.parse(await readFile(candidates[0], "utf8"));
}

const evidence = Object.fromEntries(await Promise.all(Object.entries(releaseQualityEvidenceNames).map(async ([id, filename]) => (
  [id, await readEvidence(filename)]
))));
const metadata = {
  generatedAt: new Date().toISOString(),
  sha: option("--sha", process.env.GITHUB_SHA || null),
  runUrl: option("--run-url", process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
    ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null)
};
const provisionalSummary = buildReleaseQualitySummary(evidence, metadata);
const calibrationHistory = await readFile(calibrationHistoryPath, "utf8")
  .then(JSON.parse, () => ({ version: 1, snapshots: [] }));
const calibrationResult = buildVisualDiffCalibration(provisionalSummary, calibrationHistory);
const summary = buildReleaseQualitySummary(evidence, {
  ...metadata,
  visualCalibration: calibrationResult.calibration,
  visualCalibrationPolicies: calibrationResult.policies
});
const history = await readFile(historyPath, "utf8").then(JSON.parse, () => ({ version: 1, snapshots: [] }));
const trendResult = buildReleaseQualityTrend(summary, history);
summary.trend = trendResult.trend;
const markdown = formatReleaseQualitySummaryMarkdown(summary);
await mkdir(outputDir, { recursive: true });
const reportPath = path.join(outputDir, "release-quality-summary.json");
const markdownPath = path.join(outputDir, "release-quality-summary.md");
const transportAlertPath = path.join(outputDir, "device-pwa-transport-alerts.json");
await Promise.all([
  writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`),
  writeFile(markdownPath, markdown),
  writeFile(historyPath, `${JSON.stringify(trendResult.history, null, 2)}\n`),
  writeFile(calibrationHistoryPath, `${JSON.stringify(calibrationResult.history, null, 2)}\n`),
  writeFile(transportAlertPath, `${JSON.stringify({
    generatedAt: metadata.generatedAt,
    status: summary.trend.devicePwaTransport.status,
    monitors: summary.trend.devicePwaTransport.monitors,
    activeAlerts: summary.trend.devicePwaTransport.activeAlerts,
    triggeredAlerts: summary.trend.devicePwaTransport.triggeredAlerts,
    notifications: summary.trend.devicePwaTransport.triggeredAlerts
  }, null, 2)}\n`)
]);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}\n`);
console.log(`릴리스 품질 요약: ${summary.status} · ${summary.categories.filter(({ status }) => status === "passed").length}/${summary.categories.length}`);
console.log(`보고서: ${reportPath}`);
for (const alert of summary.trend.devicePwaTransport.triggeredAlerts) {
  const message = `${alert.platform}/${alert.engine} PWA 전송 p95 ${Math.round(alert.observedP95LatencyMs)}ms`
    + ` > ${Math.round(alert.maximumP95LatencyMs)}ms`;
  if (process.env.GITHUB_ACTIONS === "true") console.log(`::warning title=PWA transport p95::${message}`);
  else console.warn(`PWA 전송 경보: ${message}`);
}
if (summary.status !== "passed") process.exitCode = 1;
