import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  buildWorldGeometryPolicyTrend,
  renderWorldGeometryPolicyTrendHtml
} from "./lib/worldGeometryPolicyTrend.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
async function readJsonIfPresent(filePath, fallback) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}
const inputPath = path.resolve(rootDir, argumentValue("--input", ".superpowers/visual-regression/world-geometry-policy-report.json"));
const historyPath = path.resolve(rootDir, argumentValue("--history", ".superpowers/visual-regression/world-geometry-policy-history.json"));
const reportPath = path.resolve(rootDir, argumentValue("--out", ".superpowers/visual-regression/world-geometry-policy-tuning.json"));
const htmlPath = path.resolve(rootDir, argumentValue("--html", ".superpowers/visual-regression/world-geometry-policy-tuning.html"));
const sha = argumentValue("--sha", process.env.GITHUB_SHA ?? "local");
const refLabel = argumentValue("--ref-label", process.env.GITHUB_REF_NAME ?? null);
const [currentReport, history] = await Promise.all([
  readJsonIfPresent(inputPath, null),
  readJsonIfPresent(historyPath, { version: 1, snapshots: [] })
]);
if (!currentReport) throw new Error(`정책 보고서가 없습니다: ${inputPath}`);
const result = buildWorldGeometryPolicyTrend(currentReport, history, { sha, refLabel });
await Promise.all([historyPath, reportPath, htmlPath].map((filePath) => mkdir(path.dirname(filePath), { recursive: true })));
await writeFile(historyPath, `${JSON.stringify(result.history, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
await writeFile(htmlPath, renderWorldGeometryPolicyTrendHtml(result.history, result.report));
console.log(`월드 지오메트리 정책 튜닝 보고서: ${result.report.snapshotCount}개 스냅샷 · ${result.report.status}`);
console.log(reportPath);
console.log(htmlPath);
