import path from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildMapForegroundPrSummary } from "./lib/mapForegroundPrSummary.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const reportPath = path.resolve(rootDir, argumentValue(
  "--report",
  ".superpowers/visual-regression/map-foreground-audit.json"
));
const outputPath = path.resolve(rootDir, argumentValue(
  "--out",
  ".superpowers/visual-regression/map-foreground-pr-summary.md"
));
const threshold = Number(argumentValue("--threshold", "8"));
if (!Number.isFinite(threshold) || threshold < 0) throw new Error("threshold는 0 이상의 숫자여야 합니다");

const report = JSON.parse(await readFile(reportPath, "utf8"));
const trendPath = path.resolve(rootDir, argumentValue(
  "--trend",
  ".superpowers/visual-regression/map-foreground-depth-trend.json"
));
let trend = null;
try {
  trend = JSON.parse(await readFile(trendPath, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const summary = buildMapForegroundPrSummary(report, {
  runUrl: argumentValue("--run-url", ""),
  threshold,
  trend
});
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, summary);
console.log(`PR 전경 진단 요약 생성 완료: ${outputPath}`);
