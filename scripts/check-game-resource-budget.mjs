import path from "node:path";
import { fileURLToPath } from "node:url";
import { runGameResourceBudgetAudit } from "./lib/gameResourceBudget.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, ".superpowers/visual-regression/game-resource-budget");
const result = await runGameResourceBudgetAudit({ rootDir, outputDir });

console.log(
  `게임 요청 예산 통과: 기본 CSS ${result.summary.base.cssRequests}개/${result.summary.base.cssGzipBytes}B`
  + ` · 폰트 ${result.summary.base.fontRequests}개/${result.summary.base.fontBytes}B`
);
console.log(
  `오시는 길 추가 CSS ${result.summary.directions.additionalCssRequests}개`
  + ` · 폰트 ${result.summary.directions.additionalFontRequests}개`
);
console.log(
  `게임 기록·설정 추가 CSS ${result.summary.vault.additionalCssRequests}개/${result.summary.vault.additionalCssGzipBytes}B`
  + ` · 폰트 ${result.summary.vault.additionalFontRequests}개/${result.summary.vault.additionalFontBytes}B`
);
console.log(
  `핵심 오프라인 캐시: ${result.precache.core.total}개`
  + ` · 원본 ${result.precache.core.rawBytes}B · 전송 ${result.precache.core.transferBytes}B`
  + ` · 누락 ${result.precache.core.missing.length}개`
);
console.log(
  `선택 기능 캐시: ${result.precache.features.total}개`
  + ` · 원본 ${result.precache.features.rawBytes}B · 전송 ${result.precache.features.transferBytes}B`
  + ` · 누락 ${result.precache.features.missing.length}개`
);
console.log(`보고서: ${result.reportPath}`);
