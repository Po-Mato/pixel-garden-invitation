import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditIosWdaPreinstall,
  iosWdaPreinstallBudgetMs,
  iosWdaPreinstallHardLimitMs
} from "./lib/iosWdaPreinstallBudget.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const outputPath = path.resolve(option(
  "--output",
  path.join(rootDir, ".superpowers/visual-regression/ios-safari/ios-wda-preinstall-budget.json")
));
const report = auditIosWdaPreinstall({
  durationMs: option("--duration-ms"),
  sourceBytes: option("--source-bytes", 0),
  installBytes: option("--install-bytes", 0),
  budgetMs: option("--budget-ms", iosWdaPreinstallBudgetMs),
  hardLimitMs: option("--hard-limit-ms", iosWdaPreinstallHardLimitMs)
});
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`);
const summary = `WDA 선설치: ${Math.round(report.durationMs / 1000)}초/${Math.round(report.budgetMs / 1000)}초`
  + ` · 번들 ${Math.round(report.installBytes / 1024 / 1024)}MB`
  + ` · ${report.status}`;
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n- ${summary}\n`);
console.log(summary);
console.log(`보고서: ${outputPath}`);
if (report.status === "watch" && process.env.GITHUB_ACTIONS === "true") {
  console.log(`::warning title=WDA preinstall target::${Math.round(report.durationMs / 1000)}초 > ${Math.round(report.budgetMs / 1000)}초 목표`);
}
if (report.status === "failed") process.exitCode = 1;
