import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMobileDeviceSoakAudit } from "./lib/mobileDeviceSoakAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, ".superpowers/visual-regression/mobile-device-soak");
const result = await runMobileDeviceSoakAudit({ rootDir, outputDir });
console.log(`모바일 장시간 감사 통과: ${result.reports.length}개 기기 프로필`);
for (const report of result.reports) {
  const { averageFps, baselineFps, frameRatio } = report.metrics;
  const { mode, reason, effects } = report.metrics.automaticQuality;
  console.log(`- ${report.id}: ${averageFps} FPS / 러너 ${baselineFps} FPS (${Math.round(frameRatio * 100)}%) · ${mode}/${reason}/${effects} · 반복 터치 ${report.interactionCount}회`);
}
console.log(`보고서: ${result.reportPath}`);
