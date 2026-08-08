import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mobileSoakProfiles,
  runMobileDeviceSoakAudit
} from "./lib/mobileDeviceSoakAudit.mjs";
import {
  lowPowerSoakProfileId,
  requiredLowPowerRuns,
  writeMobileDeviceSoakTrend
} from "./lib/mobileDeviceSoakTrend.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, ".superpowers/visual-regression/mobile-device-soak");
const result = await runMobileDeviceSoakAudit({ rootDir, outputDir, throwOnIssues: false });
const lowPowerProfile = mobileSoakProfiles.find(({ id }) => id === lowPowerSoakProfileId);
if (!lowPowerProfile) throw new Error("저전력 감사 프로필을 찾을 수 없습니다.");
const repeatedReports = [{ reports: result.reports }];
for (let run = 2; run <= requiredLowPowerRuns; run += 1) {
  const repeatOutputDir = path.join(outputDir, `repeat-${run}`);
  repeatedReports.push(await runMobileDeviceSoakAudit({
    rootDir,
    outputDir: repeatOutputDir,
    port: 4178 + run,
    profiles: [lowPowerProfile],
    throwOnIssues: false
  }));
}
const trendResult = await writeMobileDeviceSoakTrend({
  reports: repeatedReports,
  outputDir,
  metadata: {
    sha: process.env.GITHUB_SHA ?? "",
    runId: process.env.GITHUB_RUN_ID ?? "",
    refLabel: process.env.GITHUB_REF_NAME ?? "local"
  }
});
const regularIssues = result.reports
  .filter(({ id }) => id !== lowPowerSoakProfileId)
  .flatMap((report) => report.issues.map((issue) => `${report.id}: ${issue}`));
const issues = [...regularIssues, ...trendResult.trend.issues.map((issue) => `${lowPowerSoakProfileId}: ${issue}`)];
if (issues.length > 0) throw new Error(`Mobile device soak audit failed:\n${issues.join("\n")}`);
console.log(`모바일 장시간 감사 통과: ${result.reports.length}개 기기 프로필`);
for (const report of result.reports) {
  const { averageFps, baselineFps, frameRatio } = report.metrics;
  const { p95FrameMs, p99FrameMs } = report.metrics.frameTimings;
  const { mode, reason, effects } = report.metrics.automaticQuality;
  const transitions = report.metrics.zoneTransitions;
  const bottleneck = report.metrics.zoneBottlenecks.zones[0];
  const decodeZone = report.metrics.zoneBottlenecks.zones.find(({ zoneId }) => zoneId === report.metrics.zoneBottlenecks.worstDecodeZoneId);
  const motion = report.metrics.motionResponse;
  const inputLatency = motion.inputLatencyMs ?? (report.metrics.motionResponseTimingPolicy === "availability-only" ? "러너 제한" : "미측정");
  console.log(`- ${report.id}: ${averageFps} FPS / 러너 ${baselineFps} FPS (${Math.round(frameRatio * 100)}%) · 감지 ${motion.detectedRefreshHz}Hz · 입력/안정화 ${inputLatency}/${motion.settleLatencyMs}ms · p95/p99 ${p95FrameMs}/${p99FrameMs}ms · ${mode}/${reason}/${effects} · 반복 터치 ${report.interactionCount}회 · 구역 전환 ${transitions.transitionCount}회/중심 ${transitions.maxCenterErrorPx}px · 최악 ${bottleneck.zoneId} p99 ${bottleneck.p99FrameMs}ms${decodeZone ? ` · cold decode 최악 ${decodeZone.zoneId} ${decodeZone.maximumImageDecodeReadyMs}ms` : ""}${report.tracePath ? ` · trace ${report.tracePath}` : ""}`);
}
console.log(`보고서: ${result.reportPath}`);
console.log(`저전력 3회 중앙값: ${trendResult.trend.medians.averageFps} FPS · p95/p99 ${trendResult.trend.medians.p95FrameMs}/${trendResult.trend.medians.p99FrameMs}ms · decode ${trendResult.trend.medians.maximumImageDecodeReadyMs}ms`);
console.log(`저전력 추세: ${trendResult.reportPath}`);
