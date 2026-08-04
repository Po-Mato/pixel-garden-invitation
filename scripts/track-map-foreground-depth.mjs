import path from "node:path";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  buildMapForegroundDepthTrend,
  renderMapForegroundDepthTrendHtml,
  renderMapForegroundDepthTrendMarkdown
} from "./lib/mapForegroundDepthTrend.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function readJsonIfPresent(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

const auditPath = path.resolve(rootDir, argumentValue(
  "--report",
  ".superpowers/visual-regression/map-foreground-audit.json"
));
const historyPath = path.resolve(rootDir, argumentValue(
  "--history",
  ".superpowers/visual-regression/map-foreground-depth-history.json"
));
const trendPath = path.resolve(rootDir, argumentValue(
  "--out",
  ".superpowers/visual-regression/map-foreground-depth-trend.json"
));
const summaryPath = path.resolve(rootDir, argumentValue(
  "--summary",
  ".superpowers/visual-regression/map-foreground-depth-trend.md"
));
const htmlPath = path.resolve(rootDir, argumentValue(
  "--html",
  ".superpowers/visual-regression/map-foreground-depth-trend.html"
));
const warningDelta = Number(argumentValue("--warning-delta", "12"));
const sha = argumentValue("--sha", process.env.GITHUB_SHA ?? "local");

const audit = JSON.parse(await readFile(auditPath, "utf8"));
if (audit.status !== "passed") throw new Error("통과한 전경 감사 보고서가 있어야 depthGap 추세를 계산할 수 있습니다");
const history = await readJsonIfPresent(historyPath, { version: 1, snapshots: [] });
const result = buildMapForegroundDepthTrend(audit, history, { sha, warningDelta });
const markdown = renderMapForegroundDepthTrendMarkdown(result.report);
const html = renderMapForegroundDepthTrendHtml(result.history, result.report);

await mkdir(path.dirname(historyPath), { recursive: true });
await mkdir(path.dirname(trendPath), { recursive: true });
await mkdir(path.dirname(summaryPath), { recursive: true });
await mkdir(path.dirname(htmlPath), { recursive: true });
await writeFile(historyPath, `${JSON.stringify(result.history, null, 2)}\n`);
await writeFile(trendPath, `${JSON.stringify(result.report, null, 2)}\n`);
await writeFile(summaryPath, markdown);
await writeFile(htmlPath, html);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}`);

for (const warning of result.report.warnings) {
  console.log(`::warning title=전경 depthGap 급변::${warning.zoneId}/${warning.decorationId} ${warning.delta > 0 ? "+" : ""}${warning.delta}px`);
}
console.log(`전경 depthGap 추세: ${result.report.status} · 변경 ${result.report.changeCount}개 · 경고 ${result.report.warningCount}개`);
console.log(trendPath);
console.log(htmlPath);
