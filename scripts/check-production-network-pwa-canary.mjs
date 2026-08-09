import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareProductionNetworkPwaCanary,
  verifyProductionNetworkPwaCanary
} from "./lib/productionNetworkPwaCanary.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name, fallback = "") => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const phase = read("--phase");
const input = {
  url: read("--url", "https://po-mato.github.io/pixel-garden-invitation/"),
  expectedSha: read("--expected-sha"),
  profileDir: read("--profile-dir", path.join(rootDir, ".superpowers/visual-regression/production-network-pwa-profile")),
  outputDir: read("--output", path.join(rootDir, ".superpowers/visual-regression/production-network-pwa-canary"))
};

if (phase === "prepare") {
  const result = await prepareProductionNetworkPwaCanary(input);
  console.log(`배포 전 공개 PWA 준비 완료: ${result.previousVersion} · 프리캐시 ${result.expectedPathCount}개`);
  console.log(`보고서: ${result.reportPath}`);
} else if (phase === "verify") {
  const result = await verifyProductionNetworkPwaCanary(input);
  const { freshColdStart, update, updatedColdStart } = result.snapshot;
  console.log(`공개 느린 4G·PWA 카나리 통과: 최초 ${freshColdStart.entryVisibleMs}ms · 교체 ${update.installState} · 갱신 후 ${updatedColdStart.entryVisibleMs}ms`);
  console.log(`최근 5회 배포 추세: ${result.trend.status} · 표본 ${result.trend.sampleCount}/${result.trend.requiredSampleCount}`);
  console.log(`보고서: ${result.reportPath}`);
} else {
  throw new TypeError("--phase prepare 또는 --phase verify가 필요합니다.");
}
