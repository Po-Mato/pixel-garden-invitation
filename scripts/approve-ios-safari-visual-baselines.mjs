import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { approveIosSafariVisualBaselines } from "./lib/iosSafariVisualBaseline.mjs";
import { parseBaselineApprovalArgs } from "./lib/mobileVisualBaselineApproval.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseBaselineApprovalArgs(process.argv.slice(2));
const directoryIndex = process.argv.indexOf("--captures-dir");
const capturesDir = directoryIndex >= 0
  ? path.resolve(process.argv[directoryIndex + 1])
  : path.join(rootDir, ".superpowers/visual-regression/ios-safari");
const captureReport = JSON.parse(await readFile(path.join(capturesDir, "ios-safari-capture-report.json"), "utf8"));
const result = await approveIosSafariVisualBaselines({
  rootDir,
  capturesDir,
  reason: options.reason,
  captureReport
});
console.log(`실제 iOS Safari 기준선 승인 완료: ${result.metadata.profiles.length}개 화면`);
console.log(`승인 기록: ${result.metadataPath}`);
