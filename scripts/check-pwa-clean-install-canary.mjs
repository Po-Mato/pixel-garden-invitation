import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPwaCleanInstallCanary } from "./lib/pwaCleanInstallCanary.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, ".superpowers/visual-regression/pwa-clean-install-canary");
const result = await runPwaCleanInstallCanary({ rootDir, outputDir });

console.log(
  `PWA 새 설치 오프라인 카나리 통과: 프리캐시 ${result.snapshot.cachedPaths}/${result.snapshot.expectedPaths}`
  + ` · 진입/게임 재실행 성공`
);
console.log(`보고서: ${result.reportPath}`);
