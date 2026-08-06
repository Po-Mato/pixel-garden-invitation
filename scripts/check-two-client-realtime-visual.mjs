import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTwoClientRealtimeVisualAudit } from "./lib/twoClientRealtimeVisualAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, ".superpowers/visual-regression/two-client-realtime");
const result = await runTwoClientRealtimeVisualAudit({ rootDir, outputDir });

console.log(`실제 2인 동시 접속 시각 회귀 통과: 이동 ${result.metrics.movementDistance}px · 장면 ${result.metrics.snapshots.length}개`);
console.log(`보고서: ${result.reportPath}`);
