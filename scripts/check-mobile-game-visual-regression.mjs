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
const baselinePath = path.join(rootDir, "scripts/visual-baselines/mobile-game-visual-regression.webp");

const rendered = await renderMobileGameVisualAudit({ rootDir, outputPath: currentPath });
const comparison = await compareMobileGameVisualAudit({ currentPath, baselinePath, diffPath });

console.log(
  `모바일 시각 회귀 통과: ${(comparison.changedRatio * 100).toFixed(3)}% 변경 `
  + `(허용 ${(comparison.maxChangedRatio * 100).toFixed(3)}%)`
);
console.log(`현재 시트: ${rendered.outputPath}`);
console.log(`차이 시트: ${diffPath}`);
