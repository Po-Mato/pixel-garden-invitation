import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auditMapForegroundPlacements } from "./lib/mapForegroundAuditRenderer.mjs";
import { previewReviewedForegroundPatch } from "./lib/reviewedForegroundPatch.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function argumentValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const patchArgument = argumentValue("--patch");
if (!patchArgument) throw new Error("--patch <검토 JSON 파일>이 필요합니다");
const patchPath = path.resolve(process.cwd(), patchArgument);
const contractPath = path.resolve(rootDir, argumentValue(
  "--target",
  "client/src/game/worldForegroundPlacements.json"
));
const previewPath = path.resolve(rootDir, argumentValue(
  "--preview-out",
  ".superpowers/visual-regression/reviewed-map-foreground-preview.json"
));
const rollbackPath = path.resolve(rootDir, argumentValue(
  "--rollback-out",
  ".superpowers/visual-regression/reviewed-map-foreground-rollback.json"
));
const writeContract = process.argv.includes("--write");
const [contractSource, patchSource] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(patchPath, "utf8")
]);
const patch = JSON.parse(patchSource);
const preview = previewReviewedForegroundPatch(contractSource, patch);

await Promise.all([
  mkdir(path.dirname(previewPath), { recursive: true }),
  mkdir(path.dirname(rollbackPath), { recursive: true })
]);
await writeFile(previewPath, `${JSON.stringify({
  version: 1,
  target: patch.target,
  sourceChecksum: preview.sourceChecksum,
  proposedChecksum: preview.proposedChecksum,
  acceptedPlacementKeys: patch.acceptedPlacementKeys,
  operationCount: patch.operationCount,
  operations: patch.operations,
  proposedContract: preview.proposedContract
}, null, 2)}\n`);
await writeFile(rollbackPath, `${JSON.stringify(preview.rollback, null, 2)}\n`);

for (const operation of patch.operations) {
  console.log(`REVIEWED ${operation.op} ${operation.path}${operation.value === undefined ? "" : ` = ${JSON.stringify(operation.value)}`}`);
}
console.log(`검토 패치 미리보기 완료: ${patch.acceptedPlacementKeys.length}개 전경 · ${patch.operationCount}개 연산`);
console.log(`원본 SHA-256: ${preview.sourceChecksum}`);
console.log(`예상 SHA-256: ${preview.proposedChecksum}`);
console.log(previewPath);
console.log(rollbackPath);

if (writeContract) {
  await writeFile(contractPath, preview.proposedSource);
  try {
    await auditMapForegroundPlacements({
      rootDir,
      manifestPath: path.join(rootDir, "map-assets/reference/v2/manifest.json"),
      placementsByZone: preview.proposedContract.zones
    });
  } catch (error) {
    await writeFile(contractPath, contractSource);
    throw new Error(`검토 패치 재감사 실패로 원본을 자동 복원했습니다: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log(`체크섬 검증·적용·재감사 완료: ${contractPath}`);
}
