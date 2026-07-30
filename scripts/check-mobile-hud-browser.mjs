import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMobileHudBrowserAudit } from "./lib/mobileHudBrowserAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, ".superpowers/visual-regression/mobile-hud-browser");
const result = await runMobileHudBrowserAudit({ rootDir, outputDir });

console.log(`모바일 HUD 브라우저 감사 통과: ${result.reports.length}개 화면`);
for (const report of result.reports) console.log(`- ${report.id}: ${report.width}x${report.height} · 터치 ${report.touchResponse.latencyMs}ms`);
console.log(`보고서: ${result.reportPath}`);
