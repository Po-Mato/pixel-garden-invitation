import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { renderMobileGameVisualAudit } from "./lib/mobileGameVisualAuditRenderer.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outIndex = process.argv.indexOf("--out");
const outputPath = outIndex >= 0
  ? path.resolve(rootDir, process.argv[outIndex + 1])
  : path.join(rootDir, ".superpowers/character-review/mobile-game-visual-regression.png");
const updateBaseline = process.argv.includes("--update-baseline");

const result = await renderMobileGameVisualAudit({ rootDir, outputPath });
console.log(`모바일 시각 회귀 시트 생성 완료: 맵 ${result.mapZoneIds.length}개, 캐릭터 방향 ${result.directionSampleCount}컷`);
console.log(result.outputPath);

if (updateBaseline) {
  const baselinePath = path.join(rootDir, "scripts/visual-baselines/mobile-game-visual-regression.webp");
  await sharp(result.outputPath).webp({ quality: 92, effort: 6 }).toFile(baselinePath);
  console.log(`모바일 시각 기준 이미지 갱신 완료: ${baselinePath}`);
}
