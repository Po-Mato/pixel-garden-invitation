import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMobileDeviceSoakAudit } from "./lib/mobileDeviceSoakAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, ".superpowers/visual-regression/mobile-device-soak");
const result = await runMobileDeviceSoakAudit({ rootDir, outputDir });
console.log(`모바일 장시간 감사 통과: ${result.reports.length}개 기기 프로필`);
for (const report of result.reports) {
  const { averageFps, baselineFps, frameRatio } = report.metrics;
  const { p95FrameMs, p99FrameMs } = report.metrics.frameTimings;
  const { mode, reason, effects } = report.metrics.automaticQuality;
  const transitions = report.metrics.zoneTransitions;
  const motion = report.metrics.motionResponse;
  console.log(`- ${report.id}: ${averageFps} FPS / 러너 ${baselineFps} FPS (${Math.round(frameRatio * 100)}%) · 감지 ${motion.detectedRefreshHz}Hz · 입력/안정화 ${motion.inputLatencyMs}/${motion.settleLatencyMs}ms · p95/p99 ${p95FrameMs}/${p99FrameMs}ms · ${mode}/${reason}/${effects} · 반복 터치 ${report.interactionCount}회 · 구역 전환 ${transitions.transitionCount}회/중심 ${transitions.maxCenterErrorPx}px`);
}
console.log(`보고서: ${result.reportPath}`);
