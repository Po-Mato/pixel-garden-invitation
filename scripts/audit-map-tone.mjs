import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditMapTones } from "./lib/mapToneAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await auditMapTones({ rootDir });
if (result.issues.length > 0) throw new Error(`맵 밝기·대비 감사 실패:\n${result.issues.join("\n")}`);
console.log(`맵 밝기·대비 감사 통과: ${result.reports.length}개 구역`);
for (const report of result.reports) {
  console.log(`- ${report.zoneId}: 밝기 ${report.averageLuminance.toFixed(3)} · 최소 라벨 대비 ${Math.min(...Object.values(report.contrasts)).toFixed(2)}:1`);
}
