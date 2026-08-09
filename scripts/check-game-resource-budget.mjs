import path from "node:path";
import { fileURLToPath } from "node:url";
import { runGameResourceBudgetAudit } from "./lib/gameResourceBudget.mjs";
import { writePwaCacheAssetTrend } from "./lib/pwaCacheAssetTrend.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, ".superpowers/visual-regression/game-resource-budget");
const result = await runGameResourceBudgetAudit({ rootDir, outputDir });
const assetTrend = await writePwaCacheAssetTrend({
  outputDir,
  precache: result.precache,
  metadata: { sha: process.env.GITHUB_SHA || null, runId: process.env.GITHUB_RUN_ID || null },
  summaryPath: process.env.GITHUB_STEP_SUMMARY || null,
  baselineUrl: process.env.PWA_CACHE_BASELINE_URL || null
});

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
console.log(
  `캐시 자산 변화: ${assetTrend.trend.status === "initial" ? "기준선 기록" : `추가 ${assetTrend.trend.added.length}개`
    + ` · 변경 ${assetTrend.trend.changed.length}개 · 해시 교체 ${assetTrend.trend.replaced.length}개`
    + ` · 제거 ${assetTrend.trend.removed.length}개`}`
  + ` · 배포 이력 ${assetTrend.sampleCount}개`
);
console.log(
  `논리 번들 변화 예산: ${assetTrend.trend.logicalChunkBudget.status}`
  + ` · 추적 청크 ${assetTrend.trend.logicalChunkBudget.evaluations.length}개`
);
console.log(`캐시 변화 요약: ${assetTrend.markdownPath}`);
console.log(`보고서: ${result.reportPath}`);
if (assetTrend.trend.logicalChunkBudget.status !== "passed") {
  throw new Error(`PWA logical chunk budget failed:\n${assetTrend.trend.logicalChunkBudget.issues.join("\n")}`);
}
