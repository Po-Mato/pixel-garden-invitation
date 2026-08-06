import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditMapTones } from "./lib/mapToneAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await auditMapTones({ rootDir });
if (result.issues.length > 0) throw new Error(`맵 밝기·대비 감사 실패:\n${result.issues.join("\n")}`);
console.log(`맵 밝기·대비 감사 통과: ${result.reports.length}개 구역`);
for (const report of result.reports) {
  console.log(
    `- ${report.zoneId}: 배경 ${report.averageLuminance.toFixed(3)} · 합성 ${report.sceneAverageLuminance.toFixed(3)}`
    + ` · 캐릭터 경계 최소 ${report.characterEdgeContrast.toFixed(2)}:1`
    + ` (${report.weakestCharacterPresetId}, ${report.characterPresetCount}종) · 전경 ${report.foregroundAssetCount}개`
    + ` · 이동 ${report.weakestMovementEdgeContrast.toFixed(2)}:1`
    + ` (${report.weakestMovementCharacterPresetId}/${report.weakestMovementFrameId}, ${report.movementFrameCount}프레임)`
    + ` · 최소 라벨 ${Math.min(...Object.values(report.contrasts)).toFixed(2)}:1`
    + ` · OLED ${report.displayProfiles.oled.weakestCharacterEdgeContrast.toFixed(2)}/${report.displayProfiles.oled.weakestMovementEdgeContrast.toFixed(2)}`
    + ` · LCD ${report.displayProfiles.lcd.weakestCharacterEdgeContrast.toFixed(2)}/${report.displayProfiles.lcd.weakestMovementEdgeContrast.toFixed(2)}`
  );
}
