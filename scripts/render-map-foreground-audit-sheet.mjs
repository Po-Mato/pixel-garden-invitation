import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderMapForegroundAuditSheet } from "./lib/mapForegroundAuditRenderer.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outIndex = process.argv.indexOf("--out");
const outputPath = outIndex >= 0
  ? path.resolve(rootDir, process.argv[outIndex + 1])
  : path.join(rootDir, ".superpowers/character-review/map-foreground-artifact-audit.png");

const result = await renderMapForegroundAuditSheet({
  rootDir,
  manifestPath: path.join(rootDir, "map-assets/reference/v2/manifest.json"),
  outputPath
});

console.log(`맵 전경 감사 시트 생성 완료: ${result.zoneIds.length}개 맵, ${result.instanceCount}개 전경`);
console.log(result.outputPath);
