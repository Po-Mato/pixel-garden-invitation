import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMapDiagnosticsBrowserAudit } from "./lib/mapDiagnosticsBrowserAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, ".superpowers/visual-regression/map-diagnostics-browser");
const result = await runMapDiagnosticsBrowserAudit({ rootDir, outputDir });

console.log(`맵 진단 모바일 브라우저 감사 통과: ${result.reports.length}개 화면`);
console.log(`보고서: ${result.reportPath}`);
