import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decideIosSafariCaptureRetry } from "./lib/iosSafariFailureTaxonomy.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const reportPath = path.resolve(option(
  "--report",
  path.join(rootDir, ".superpowers/visual-regression/ios-safari/ios-safari-capture-report.json")
));
const outputPath = path.resolve(option(
  "--output",
  path.join(rootDir, ".superpowers/visual-regression/ios-safari/ios-safari-capture-retry-decision.json")
));
const captureReport = await readFile(reportPath, "utf8").then(JSON.parse, () => null);
const failure = captureReport?.failure ?? {
  category: option("--fallback-category", "infrastructure"),
  kind: option("--fallback-kind", "infrastructure-pre-capture"),
  retryable: true,
  message: "캡처 보고서 생성 전 실행 실패"
};
const decision = decideIosSafariCaptureRetry({
  attempt: option("--attempt", 1),
  failure
});
const report = {
  generatedAt: new Date().toISOString(),
  reportPath,
  reportAvailable: captureReport !== null,
  failure,
  ...decision
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
const summary = `iOS 캡처 ${decision.attempt}차 실패: ${decision.category}/${decision.kind}`
  + ` · ${decision.shouldRetry ? "자동 재시도 1회" : "재시도 안 함"}`;
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n- ${summary}\n`);
console.log(summary);
console.log(`판정: ${outputPath}`);
if (!decision.shouldRetry) process.exitCode = 2;
