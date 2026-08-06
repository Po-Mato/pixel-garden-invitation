import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMobileHudBrowserAudit } from "./lib/mobileHudBrowserAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, ".superpowers/visual-regression/mobile-hud-browser");
const result = await runMobileHudBrowserAudit({ rootDir, outputDir });

console.log(`모바일 HUD 브라우저 감사 통과: ${result.reports.length}개 화면`);
for (const report of result.reports) {
  const baselineSummary = report.deviceVisualBaselines
    ? ` · 픽셀 ${Object.values(report.deviceVisualBaselines).map(({ comparison }) => `${((comparison?.changedRatio ?? 0) * 100).toFixed(3)}%`).join("/")}`
    : "";
  const touchSummary = report.touchResponse.latencyMs === null ? "WebKit 장시간 검사 연계" : `터치 ${report.touchResponse.latencyMs}ms`;
  console.log(`- ${report.id}: ${report.width}x${report.height} · ${touchSummary}${baselineSummary}`);
}
console.log(
  `전 구역 라벨 충돌 순회: ${result.zoneLabelSweep.profiles.length}개 화면 프로필`
  + ` · ${result.zoneLabelSweep.expectedZoneIds.length}개 구역 · ${result.zoneLabelSweep.reports.length}개 위치`
);
console.log(
  `글자 확대 레이아웃: ${result.typographyScaleAudit.reports.map((report) => (
    `${report.percent}% ${report.sheetScrollHeight}px/${report.minimumLineHeightRatio.toFixed(2)}`
  )).join(" · ")}`
);
console.log(
  `긴 예식장 문구: ${result.longVenueAudit.reports.map((report) => (
    `${report.width}x${report.height} ${report.metrics.venueLines}줄/${report.metrics.addressLines}줄`
  )).join(" · ")}`
);
console.log(`맵 가장자리 긴 이름표: ${result.remoteNameplateCrowd.reports.map(({ count, edge }) => `${edge} ${count}명`).join(" · ")}`);
console.log(`보고서: ${result.reportPath}`);
