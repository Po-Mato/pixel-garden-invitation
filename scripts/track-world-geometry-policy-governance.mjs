import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildWorldGeometryPolicyGovernance } from "./lib/worldGeometryPolicyGovernance.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
async function readJsonIfPresent(filePath, fallback) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return fallback; throw error; }
}
const tuningPath = path.resolve(rootDir, argumentValue("--input", ".superpowers/visual-regression/world-geometry-policy-tuning.json"));
const configPath = path.resolve(rootDir, argumentValue("--config", ".github/world-geometry-policy-owners.json"));
const statePath = path.resolve(rootDir, argumentValue("--state", ".superpowers/visual-regression/world-geometry-policy-review-state.json"));
const outputPath = path.resolve(rootDir, argumentValue("--out", ".superpowers/visual-regression/world-geometry-policy-governance.json"));
const [tuning, config, previousState] = await Promise.all([
  readJsonIfPresent(tuningPath, null),
  readJsonIfPresent(configPath, null),
  readJsonIfPresent(statePath, { version: 1, items: [] })
]);
if (!tuning) throw new Error(`정책 튜닝 보고서가 없습니다: ${tuningPath}`);
if (!config) throw new Error(`정책 담당자 설정이 없습니다: ${configPath}`);
const result = buildWorldGeometryPolicyGovernance(tuning, previousState, config, {
  generatedAt: argumentValue("--generated-at", new Date().toISOString())
});
await Promise.all([statePath, outputPath].map((filePath) => mkdir(path.dirname(filePath), { recursive: true })));
await writeFile(statePath, `${JSON.stringify(result.state, null, 2)}\n`);
await writeFile(outputPath, `${JSON.stringify(result.report, null, 2)}\n`);
console.log(`월드 정책 검토 거버넌스: ${result.report.reviewCount}개 · 만료 ${result.report.expiredCount} · 지연 ${result.report.overdueCount}`);
console.log(outputPath);
