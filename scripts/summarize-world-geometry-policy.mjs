import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildWorldGeometryPolicyPrSummary } from "./lib/worldGeometryPolicyPrSummary.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const reportPath = path.resolve(rootDir, argumentValue("--report", ".superpowers/visual-regression/world-geometry-policy-tuning.json"));
const outputPath = path.resolve(rootDir, argumentValue("--out", ".superpowers/visual-regression/world-geometry-policy-pr-summary.md"));
const governancePath = path.resolve(rootDir, argumentValue("--governance", ".superpowers/visual-regression/world-geometry-policy-governance.json"));
const approved = argumentValue("--approved", "false") === "true";
const report = JSON.parse(await readFile(reportPath, "utf8"));
let governance = null;
try { governance = JSON.parse(await readFile(governancePath, "utf8")); }
catch (error) { if (error?.code !== "ENOENT") throw error; }
const summary = buildWorldGeometryPolicyPrSummary(report, {
  approved,
  approvalLabel: argumentValue("--approval-label", "geometry-policy-approved"),
  runUrl: argumentValue("--run-url", ""),
  governance
});
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, summary.markdown);
console.log(`월드 지오메트리 정책 PR 요약: ${summary.reviewCount}개 검토 · ${summary.approvalStatus}`);
console.log(outputPath);
