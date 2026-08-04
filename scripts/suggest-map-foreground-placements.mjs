import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auditMapForegroundPlacements } from "./lib/mapForegroundAuditRenderer.mjs";
import { buildMapForegroundPlacementSuggestions } from "./lib/mapForegroundPlacementSuggestions.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const outputPath = path.resolve(rootDir, argumentValue(
  "--out",
  ".superpowers/visual-regression/map-foreground-suggestions.json"
));
const depthPadding = Number(argumentValue("--depth-padding", "0"));
const collisionPadding = Number(argumentValue("--collision-padding", "4"));
if (!Number.isFinite(depthPadding) || depthPadding < 0 || !Number.isFinite(collisionPadding) || collisionPadding < 0) {
  throw new Error("depth-padding과 collision-padding은 0 이상의 숫자여야 합니다");
}

const audit = await auditMapForegroundPlacements({
  rootDir,
  manifestPath: path.join(rootDir, "map-assets/reference/v2/manifest.json")
});
const report = buildMapForegroundPlacementSuggestions(audit, { depthPadding, collisionPadding });
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  options: { depthPadding, collisionPadding },
  ...report
}, null, 2)}\n`);

console.log(`전경 배치 추천 생성 완료: ${report.instanceCount}개 중 ${report.reviewCount}개 검토`);
console.log(outputPath);
