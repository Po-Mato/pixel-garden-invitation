import {
  buildForegroundPlacementRollbackJsonPatch,
  sha256Text,
  verifyForegroundContractChecksum
} from "./mapForegroundContractWrite.mjs";
import { applyForegroundPlacementJsonPatch } from "./mapForegroundPlacementSuggestions.mjs";

const targetPath = "client/src/game/worldForegroundPlacements.json";
const allowedOperationPath = /^\/zones\/[^/]+\/\d+\/(?:depthY|collision)$/;

function assertPatchShape(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("검토 패치는 JSON 객체여야 합니다");
  }
  if (patch.version !== 1 || patch.target !== targetPath) {
    throw new Error(`지원하지 않는 검토 패치 계약: ${patch.target ?? "unknown"}`);
  }
  if (!Array.isArray(patch.operations) || patch.operationCount !== patch.operations.length) {
    throw new Error("검토 패치 operationCount와 operations가 일치하지 않습니다");
  }
  if (!Array.isArray(patch.acceptedPlacementKeys) || patch.acceptedPlacementKeys.length === 0) {
    throw new Error("승인된 전경이 없는 검토 패치는 적용할 수 없습니다");
  }
  if (!/^[a-f0-9]{64}$/i.test(patch.sourceChecksum ?? "")) {
    throw new Error("검토 패치 sourceChecksum은 SHA-256 형식이어야 합니다");
  }
  for (const operation of patch.operations) {
    if (!["add", "remove", "replace"].includes(operation?.op) || !allowedOperationPath.test(operation?.path ?? "")) {
      throw new Error(`허용되지 않은 검토 패치 연산: ${operation?.op ?? "unknown"} ${operation?.path ?? ""}`);
    }
    if ((operation.op === "add" || operation.op === "replace") && operation.value === undefined) {
      throw new Error(`검토 패치 값이 없습니다: ${operation.path}`);
    }
  }
}

export function previewReviewedForegroundPatch(contractSource, patch) {
  assertPatchShape(patch);
  const sourceChecksum = sha256Text(contractSource);
  verifyForegroundContractChecksum(patch.sourceChecksum, sourceChecksum);
  const contract = JSON.parse(contractSource);
  if (contract.version !== patch.sourceContractVersion) {
    throw new Error(`전경 계약 버전 불일치: patch ${patch.sourceContractVersion}, source ${contract.version}`);
  }
  const proposedContract = applyForegroundPlacementJsonPatch(contract, patch.operations);
  const proposedSource = `${JSON.stringify(proposedContract, null, 2)}\n`;
  const proposedChecksum = sha256Text(proposedSource);
  const rollbackOperations = buildForegroundPlacementRollbackJsonPatch(contract, patch.operations);
  return {
    sourceChecksum,
    proposedChecksum,
    proposedContract,
    proposedSource,
    rollback: {
      version: 1,
      target: targetPath,
      expectedChecksum: proposedChecksum,
      restoresChecksum: sourceChecksum,
      operationCount: rollbackOperations.length,
      operations: rollbackOperations
    }
  };
}
