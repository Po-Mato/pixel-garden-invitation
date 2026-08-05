import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBaselineApprovalArgs } from "./lib/mobileVisualBaselineApproval.mjs";
import { runMobileHudBrowserAudit } from "./lib/mobileHudBrowserAudit.mjs";
import {
  approveMobileDeviceVisualBaselines,
  mobileDeviceVisualBaselineProfiles,
  mobileDeviceVisualBaselineStates
} from "./lib/mobileDeviceVisualBaseline.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseBaselineApprovalArgs(process.argv.slice(2));
const outputDir = path.join(rootDir, ".superpowers/visual-regression/mobile-device-baseline-approval");
const audit = await runMobileHudBrowserAudit({ rootDir, outputDir, deviceBaselineMode: "capture" });
const captures = audit.reports
  .filter((report) => mobileDeviceVisualBaselineProfiles.includes(report.id))
  .flatMap((report) => mobileDeviceVisualBaselineStates.map((state) => ({
    profileId: report.id,
    engine: report.engine,
    state,
    currentPath: report.deviceVisualBaselines[state].currentPath
  })));
const result = await approveMobileDeviceVisualBaselines({ rootDir, captures, reason: options.reason });
console.log(`모바일 기기 시각 기준선 승인 완료: ${captures.length}개 화면`);
console.log(`승인 기록: ${result.metadataPath}`);
