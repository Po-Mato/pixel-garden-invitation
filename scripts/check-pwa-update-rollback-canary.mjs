import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPwaUpdateRollbackCanary } from "./lib/pwaUpdateRollbackCanary.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, ".superpowers/visual-regression/pwa-update-rollback-canary");
const result = await runPwaUpdateRollbackCanary({ rootDir, outputDir });

console.log("PWA 교체/롤백 카나리 통과: 깨진 업데이트 거부 · 정상 교체 · 캐시 롤백 · 오프라인 재실행 성공");
console.log(`보고서: ${result.reportPath}`);
