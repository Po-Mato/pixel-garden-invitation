import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditMapEvidenceDuration, targetedMapEvidenceBudgetMs } from "./lib/mapEvidenceDurationBudget.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const outputPath = path.resolve(option(
  "--output",
  path.join(rootDir, ".superpowers/visual-regression/map-evidence-duration.json")
));
const report = auditMapEvidenceDuration({
  startedAtMs: option("--started-at-ms", process.env.MAP_EVIDENCE_STARTED_AT_MS),
  finishedAtMs: option("--finished-at-ms", Date.now()),
  budgetMs: option("--budget-ms", targetedMapEvidenceBudgetMs)
});
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`);
const summary = `맵 집중 E2E 시간: ${Math.round(report.durationMs / 1000)}초/${Math.round(report.budgetMs / 1000)}초 · ${report.status}`;
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n- ${summary}\n`);
console.log(summary);
console.log(`보고서: ${outputPath}`);
if (report.status !== "passed") process.exitCode = 1;
