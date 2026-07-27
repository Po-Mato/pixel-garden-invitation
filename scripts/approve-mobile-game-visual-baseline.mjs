import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  approveMobileVisualBaseline,
  parseBaselineApprovalArgs
} from "./lib/mobileVisualBaselineApproval.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseBaselineApprovalArgs(process.argv.slice(2));
const result = await approveMobileVisualBaseline({ rootDir, ...options });

console.log(`모바일 시각 기준 이미지 승인 완료: ${result.baselinePath}`);
console.log(`승인 기록 생성 완료: ${result.metadataPath}`);
