import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeIosSafariStabilityHistory } from "./lib/iosSafariStabilityTrend.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const inputDir = path.resolve(option("--input-dir", path.join(rootDir, ".superpowers/visual-regression/ios-safari-stability-seed")));
const historyPath = path.resolve(option(
  "--history",
  path.join(rootDir, ".superpowers/visual-regression/ios-safari-stability/ios-safari-stability-trend-history.json")
));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : entry.isFile() ? [target] : [];
  }))).flat();
}

function runIdFromPath(filePath) {
  return filePath.split(path.sep).reverse().find((part) => /^\d{8,}$/.test(part)) ?? null;
}

const current = await readFile(historyPath, "utf8").then(JSON.parse, () => ({ version: 1, samples: [] }));
const files = await filesBelow(inputDir);
const histories = await Promise.all(files
  .filter((file) => path.basename(file) === "ios-safari-stability-trend-history.json")
  .map((file) => readFile(file, "utf8").then(JSON.parse)));
let samples = mergeIosSafariStabilityHistory(
  current.samples ?? [],
  histories.flatMap(({ samples: value }) => Array.isArray(value) ? value : [])
);
const captureReports = await Promise.all(files
  .filter((file) => path.basename(file) === "ios-safari-capture-report.json")
  .map(async (file) => ({ file, report: JSON.parse(await readFile(file, "utf8")) })));
const strategies = new Map(captureReports.flatMap(({ file, report }) => {
  const inferredRunId = [...samples].reverse().find(({ compositorFaultInjected }) => compositorFaultInjected)?.runId;
  const runId = runIdFromPath(file) ?? inferredRunId;
  const strategy = report.nativeCompositor?.faultInjection?.recoveryStrategy;
  return runId && ["activate-refresh", "recreate-session"].includes(strategy) ? [[runId, strategy]] : [];
}));
samples = samples.map((sample) => strategies.has(String(sample.runId))
  ? { ...sample, compositorRecoveryStrategy: strategies.get(String(sample.runId)) }
  : sample);
await mkdir(path.dirname(historyPath), { recursive: true });
await writeFile(historyPath, `${JSON.stringify({ version: 1, samples }, null, 2)}\n`);
console.log(`iOS Safari 강화 이력 시드: ${samples.length}개 · 복구 전략 ${strategies.size}개`);
