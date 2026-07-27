import { appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareMobileGameVisualAudit,
  renderMobileGameVisualAudit
} from "./lib/mobileGameVisualAuditRenderer.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = path.join(rootDir, ".superpowers/visual-regression");
const currentPath = path.join(artifactDir, "mobile-game-current.png");
const diffPath = path.join(artifactDir, "mobile-game-diff.png");
const reportPath = path.join(artifactDir, "mobile-game-regions.json");
const baselinePath = path.join(rootDir, "scripts/visual-baselines/mobile-game-visual-regression.webp");

const rendered = await renderMobileGameVisualAudit({ rootDir, outputPath: currentPath });
const comparison = await compareMobileGameVisualAudit({
  currentPath,
  baselinePath,
  diffPath,
  reportPath,
  mapRegionIds: rendered.mapZoneIds,
  characterRegionIds: rendered.characterPresetIds
});

console.log(
  `모바일 시각 회귀 통과: ${(comparison.changedRatio * 100).toFixed(3)}% 변경 `
  + `(허용 ${(comparison.maxChangedRatio * 100).toFixed(3)}%)`
);
console.log(`현재 시트: ${rendered.outputPath}`);
console.log(`차이 시트: ${diffPath}`);
console.log("구역별 변경률:");
for (const region of comparison.regionResults) {
  console.log(`- ${region.kind}/${region.id}: ${(region.changedRatio * 100).toFixed(3)}%`);
}
console.log(`구역 보고서: ${reportPath}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = comparison.regionResults
    .map((region) => `| ${region.kind} | ${region.id} | ${(region.changedRatio * 100).toFixed(3)}% |`)
    .join("\n");
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## 모바일 시각 회귀\n\n전체 변경률 **${(comparison.changedRatio * 100).toFixed(3)}%**\n\n| 구분 | 구역 | 변경률 |\n| --- | --- | ---: |\n${rows}\n`
  );
}
