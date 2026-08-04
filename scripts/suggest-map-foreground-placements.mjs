import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auditMapForegroundPlacements } from "./lib/mapForegroundAuditRenderer.mjs";
import {
  buildForegroundPlacementRollbackJsonPatch,
  sha256Text,
  verifyForegroundContractChecksum
} from "./lib/mapForegroundContractWrite.mjs";
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
const rollbackOutputPath = path.resolve(rootDir, argumentValue(
  "--rollback-out",
  ".superpowers/visual-regression/map-foreground-rollback.patch.json"
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
  const contractSource = await readFile(contractPath, "utf8");
  const contract = JSON.parse(contractSource);
  const sourceChecksum = sha256Text(contractSource);
  const patchPreview = buildForegroundPlacementPatchPreview(contract, report.suggestions, {
    includeOptionalCollisions
  });
  const proposedSource = `${JSON.stringify(patchPreview.proposedContract, null, 2)}\n`;
  const proposedChecksum = sha256Text(proposedSource);
  const rollbackOperations = buildForegroundPlacementRollbackJsonPatch(contract, patchPreview.operations);
  await mkdir(path.dirname(patchOutputPath), { recursive: true });
  await mkdir(path.dirname(rollbackOutputPath), { recursive: true });
  await writeFile(patchOutputPath, `${JSON.stringify({
    ...patchPreview,
    sourceChecksum,
    proposedChecksum,
    rollbackOperationCount: rollbackOperations.length
  }, null, 2)}\n`);
  await writeFile(rollbackOutputPath, `${JSON.stringify({
    version: 1,
    target: patchPreview.target,
    expectedChecksum: proposedChecksum,
    restoresChecksum: sourceChecksum,
    operationCount: rollbackOperations.length,
    operations: rollbackOperations
  }, null, 2)}\n`);
  for (const operation of patchPreview.operations) {
    console.log(`PATCH ${operation.op} ${operation.path} = ${JSON.stringify(operation.value)}`);
  }
  console.log(`전경 JSON patch 미리보기: ${patchPreview.operationCount}개 연산`);
  console.log(`원본 SHA-256: ${sourceChecksum}`);
  console.log(patchOutputPath);
  console.log(rollbackOutputPath);

  if (writeContract) {
    verifyForegroundContractChecksum(argumentValue("--expect-checksum", ""), sourceChecksum);
    await writeFile(contractPath, proposedSource);
    try {
      await auditMapForegroundPlacements({
        rootDir,
        manifestPath: path.join(rootDir, "map-assets/reference/v2/manifest.json"),
        placementsByZone: patchPreview.proposedContract.zones
      });
    } catch (error) {
      await writeFile(contractPath, contractSource);
      throw new Error(`전경 계약 재감사 실패로 원본을 자동 복원했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log(`명시적 --write 적용 및 재감사 완료: ${contractPath}`);
  }
}

console.log(`전경 배치 추천 생성 완료: ${report.instanceCount}개 중 ${report.reviewCount}개 검토`);
console.log(outputPath);
