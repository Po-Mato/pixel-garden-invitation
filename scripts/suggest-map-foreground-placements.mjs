import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auditMapForegroundPlacements } from "./lib/mapForegroundAuditRenderer.mjs";
import {
  buildForegroundPlacementPatchPreview,
  buildMapForegroundPlacementSuggestions
} from "./lib/mapForegroundPlacementSuggestions.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const outputPath = path.resolve(rootDir, argumentValue(
  "--out",
  ".superpowers/visual-regression/map-foreground-suggestions.json"
));
const patchOutputPath = path.resolve(rootDir, argumentValue(
  "--patch-out",
  ".superpowers/visual-regression/map-foreground-suggestions.patch.json"
));
const contractPath = path.join(rootDir, "client/src/game/worldForegroundPlacements.json");
const depthPadding = Number(argumentValue("--depth-padding", "0"));
const collisionPadding = Number(argumentValue("--collision-padding", "4"));
const previewPatch = process.argv.includes("--preview-patch");
const writeContract = process.argv.includes("--write");
const includeOptionalCollisions = process.argv.includes("--include-optional-collisions");
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
  options: { depthPadding, collisionPadding, includeOptionalCollisions },
  ...report
}, null, 2)}\n`);

if (previewPatch || writeContract) {
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const patchPreview = buildForegroundPlacementPatchPreview(contract, report.suggestions, {
    includeOptionalCollisions
  });
  await mkdir(path.dirname(patchOutputPath), { recursive: true });
  await writeFile(patchOutputPath, `${JSON.stringify(patchPreview, null, 2)}\n`);
  for (const operation of patchPreview.operations) {
    console.log(`PATCH ${operation.op} ${operation.path} = ${JSON.stringify(operation.value)}`);
  }
  console.log(`전경 JSON patch 미리보기: ${patchPreview.operationCount}개 연산`);
  console.log(patchOutputPath);

  if (writeContract) {
    await writeFile(contractPath, `${JSON.stringify(patchPreview.proposedContract, null, 2)}\n`);
    await auditMapForegroundPlacements({
      rootDir,
      manifestPath: path.join(rootDir, "map-assets/reference/v2/manifest.json"),
      placementsByZone: patchPreview.proposedContract.zones
    });
    console.log(`명시적 --write 적용 및 재감사 완료: ${contractPath}`);
  }
}

console.log(`전경 배치 추천 생성 완료: ${report.instanceCount}개 중 ${report.reviewCount}개 검토`);
console.log(outputPath);
