import { sha256Text } from "./mapForegroundContractWrite.mjs";
import { applyForegroundPlacementJsonPatch } from "./mapForegroundPlacementSuggestions.mjs";
import { previewReviewedForegroundPatch } from "./reviewedForegroundPatch.mjs";

function unescapePointer(value) {
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}

export function buildApprovedForegroundPatch(contractSource, suggestionPatch, {
  approvedBy = "github-actions[bot]",
  approvalLabel = "map-foreground-patch-approved",
  pullRequestNumber = null,
  headSha = null,
  generatedAt = new Date().toISOString()
} = {}) {
  if (!suggestionPatch || suggestionPatch.version !== 1 || suggestionPatch.target !== "client/src/game/worldForegroundPlacements.json") {
    throw new Error("지원하지 않는 자동 적용 전경 패치입니다");
  }
  if (!Array.isArray(suggestionPatch.operations) || suggestionPatch.operationCount !== suggestionPatch.operations.length || suggestionPatch.operations.length === 0) {
    throw new Error("자동 적용 전경 패치에 연산이 없습니다");
  }
  const sourceChecksum = sha256Text(contractSource);
  if (suggestionPatch.sourceChecksum !== sourceChecksum) throw new Error(`자동 적용 원본 체크섬 불일치: ${suggestionPatch.sourceChecksum} != ${sourceChecksum}`);
  const contract = JSON.parse(contractSource);
  const placementKeys = suggestionPatch.operations.map((operation) => {
    const match = operation.path?.match(/^\/zones\/([^/]+)\/(\d+)\/(?:depthY|collision)$/);
    if (!match) throw new Error(`자동 적용 허용 범위를 벗어난 연산: ${operation.path}`);
    const zoneId = unescapePointer(match[1]);
    const placement = contract.zones?.[zoneId]?.[Number(match[2])];
    if (!placement?.decorationId) throw new Error(`자동 적용 전경을 찾을 수 없습니다: ${operation.path}`);
    return `${zoneId}/${placement.decorationId}`;
  });
  const reviewedPatch = {
    version: 1,
    target: suggestionPatch.target,
    sourceContractVersion: contract.version,
    sourceChecksum,
    generatedAt,
    acceptedPlacementKeys: [...new Set(placementKeys)],
    operationCount: suggestionPatch.operations.length,
    operations: suggestionPatch.operations,
    approval: { approvedBy, approvalLabel, pullRequestNumber, headSha }
  };
  const preview = previewReviewedForegroundPatch(contractSource, reviewedPatch);
  const directProposedSource = `${JSON.stringify(applyForegroundPlacementJsonPatch(contract, suggestionPatch.operations), null, 2)}\n`;
  if (preview.proposedSource !== directProposedSource) throw new Error("자동 적용 미리보기 결과가 일치하지 않습니다");
  if (suggestionPatch.proposedChecksum && suggestionPatch.proposedChecksum !== preview.proposedChecksum) {
    throw new Error(`자동 적용 결과 체크섬 불일치: ${suggestionPatch.proposedChecksum} != ${preview.proposedChecksum}`);
  }
  return { reviewedPatch, proposedSource: preview.proposedSource, proposedChecksum: preview.proposedChecksum };
}
