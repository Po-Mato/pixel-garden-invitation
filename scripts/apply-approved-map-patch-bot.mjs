import path from "node:path";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { buildApprovedForegroundPatch } from "./lib/mapForegroundPatchAutomation.mjs";

function argumentValue(name, fallback = null) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; }
const workspace = await realpath(path.resolve(argumentValue("--workspace", process.cwd())));
const patchArgument = argumentValue("--patch");
if (!patchArgument) throw new Error("--patch <CI 추천 패치>가 필요합니다");
const targetPath = path.join(workspace, "client/src/game/worldForegroundPlacements.json");
const patchPath = path.resolve(patchArgument);
const targetStat = await lstat(targetPath);
const resolvedTargetPath = await realpath(targetPath);
const targetRelativePath = path.relative(workspace, resolvedTargetPath);
if (!targetStat.isFile() || targetRelativePath.startsWith("..") || path.isAbsolute(targetRelativePath)) {
  throw new Error("자동 적용 대상은 작업 폴더 안의 일반 파일이어야 합니다");
}
const [contractSource, patchSource] = await Promise.all([readFile(targetPath, "utf8"), readFile(patchPath, "utf8")]);
const result = buildApprovedForegroundPatch(contractSource, JSON.parse(patchSource), {
  approvedBy: argumentValue("--approved-by", "github-actions[bot]"),
  approvalLabel: argumentValue("--approval-label", "map-foreground-patch-approved"),
  pullRequestNumber: argumentValue("--pr-number"),
  headSha: argumentValue("--head-sha")
});
await writeFile(targetPath, result.proposedSource);
console.log(`승인 전경 패치 적용 준비: ${result.reviewedPatch.acceptedPlacementKeys.length}개 전경 · ${result.reviewedPatch.operationCount}개 연산`);
console.log(`예상 SHA-256: ${result.proposedChecksum}`);
console.log(targetPath);
