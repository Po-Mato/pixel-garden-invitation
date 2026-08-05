import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { approveAndroidChromeVisualBaselines } from "./lib/androidChromeVisualBaseline.mjs";
import { parseBaselineApprovalArgs } from "./lib/mobileVisualBaselineApproval.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const directoryIndex = process.argv.indexOf("--captures-dir");
const capturesDir = directoryIndex >= 0
  ? path.resolve(process.argv[directoryIndex + 1])
  : path.join(rootDir, ".superpowers/visual-regression/android-chrome");
const approvalArgs = process.argv.slice(2).filter((argument, index, args) => (
  argument !== "--captures-dir" && args[index - 1] !== "--captures-dir"
));
const options = parseBaselineApprovalArgs(approvalArgs);
const captureReport = JSON.parse(await readFile(path.join(capturesDir, "android-chrome-capture-report.json"), "utf8"));
const result = await approveAndroidChromeVisualBaselines({
  rootDir,
  capturesDir,
  reason: options.reason,
  captureReport
});
console.log(`실제 Android Chrome 기준선 승인 완료: ${result.metadata.profiles.length}개 화면`);
console.log(`승인 기록: ${result.metadataPath}`);
