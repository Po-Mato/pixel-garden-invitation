import type { WorldZoneId } from "@wedding-game/shared";
import { worldForegroundPlacements, type Rect } from "./world";
import {
  worldForegroundPlacementTarget,
  worldForegroundSourceChecksum,
  worldForegroundSourceContractVersion,
  type ForegroundRecommendationDecision,
  type WorldForegroundRecommendationPatch,
  type WorldForegroundRecommendationReview,
  type WorldForegroundJsonPatchOperation
} from "./worldForegroundRecommendations";

export type WorldForegroundPatchPreview = {
  patch: WorldForegroundRecommendationPatch;
  decisions: Partial<Record<string, ForegroundRecommendationDecision>>;
  reviewsByZone: Partial<Record<WorldZoneId, WorldForegroundRecommendationReview[]>>;
  zoneIds: WorldZoneId[];
};

const operationPath = /^\/zones\/([^/]+)\/(\d+)\/(depthY|collision)$/;

function isRect(value: unknown): value is Rect {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rect = value as Partial<Rect>;
  return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    && Number(rect.x) >= 0
    && Number(rect.y) >= 0
    && Number(rect.width) > 0
    && Number(rect.height) > 0;
}

function sameRect(left: Rect | null, right: Rect | null): boolean {
  if (!left || !right) return left === right;
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height;
}

function parseOperation(operation: WorldForegroundJsonPatchOperation) {
  const match = operationPath.exec(operation.path);
  if (!match || !["add", "remove", "replace"].includes(operation.op)) {
    throw new Error(`허용되지 않은 Patch 연산입니다: ${operation.op} ${operation.path}`);
  }
  const [, rawZoneId, rawIndex, field] = match;
  const zoneId = rawZoneId as WorldZoneId;
  const placements = worldForegroundPlacements[zoneId];
  const index = Number(rawIndex);
  const placement = placements?.[index];
  if (!placement) throw new Error(`Patch 대상 전경을 찾을 수 없습니다: ${operation.path}`);
  if (field === "depthY") {
    if (operation.op !== "replace" || !Number.isFinite(operation.value) || typeof operation.value !== "number") {
      throw new Error(`depthY Patch는 숫자 replace만 허용합니다: ${operation.path}`);
    }
  } else if (operation.op !== "remove" && !isRect(operation.value)) {
    throw new Error(`collision Patch 값이 올바른 사각형이 아닙니다: ${operation.path}`);
  }
  return { zoneId, index, field, placement };
}

export function previewWorldForegroundRecommendationPatch(value: unknown): WorldForegroundPatchPreview {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Patch JSON 객체가 필요합니다");
  const patch = value as WorldForegroundRecommendationPatch;
  if (
    patch.version !== 1
    || patch.target !== worldForegroundPlacementTarget
    || patch.sourceContractVersion !== worldForegroundSourceContractVersion
    || patch.sourceChecksum !== worldForegroundSourceChecksum
  ) throw new Error("현재 전경 계약과 Patch 원본 체크섬이 일치하지 않습니다");
  if (!Array.isArray(patch.operations) || patch.operationCount !== patch.operations.length || patch.operationCount === 0) {
    throw new Error("Patch 연산 수가 올바르지 않습니다");
  }
  if (!Array.isArray(patch.acceptedPlacementKeys) || patch.acceptedPlacementKeys.length === 0) {
    throw new Error("승인된 전경 키가 없습니다");
  }

  const acceptedKeys = new Set(patch.acceptedPlacementKeys);
  if (acceptedKeys.size !== patch.acceptedPlacementKeys.length) throw new Error("승인된 전경 키가 중복되었습니다");
  const operationKeys = new Set<string>();
  const operationPaths = new Set<string>();
  const proposed = new Map<string, { zoneId: WorldZoneId; decorationId: string; depthY: number; collision: Rect | null }>();

  patch.operations.forEach((operation) => {
    if (operationPaths.has(operation.path)) throw new Error(`Patch 경로가 중복되었습니다: ${operation.path}`);
    operationPaths.add(operation.path);
    const { zoneId, field, placement } = parseOperation(operation);
    const key = `${zoneId}/${placement.decorationId}`;
    if (!acceptedKeys.has(key)) throw new Error(`승인되지 않은 전경 연산입니다: ${key}`);
    operationKeys.add(key);
    const next = proposed.get(key) ?? {
      zoneId,
      decorationId: placement.decorationId,
      depthY: placement.depthY,
      collision: placement.collision ?? null
    };
    if (field === "depthY") next.depthY = operation.value as number;
    else next.collision = operation.op === "remove" ? null : operation.value as Rect;
    proposed.set(key, next);
  });
  if ([...acceptedKeys].some((key) => !operationKeys.has(key))) {
    throw new Error("승인된 전경 키와 Patch 연산 대상이 일치하지 않습니다");
  }

  const reviewsByZone: WorldForegroundPatchPreview["reviewsByZone"] = {};
  const decisions: WorldForegroundPatchPreview["decisions"] = {};
  for (const [key, next] of proposed) {
    const placement = worldForegroundPlacements[next.zoneId]
      .find((candidate) => candidate.decorationId === next.decorationId)!;
    const currentCollision = placement.collision ?? null;
    const collisionChanged = !sameRect(currentCollision, next.collision);
    const review: WorldForegroundRecommendationReview = {
      key,
      zoneId: next.zoneId,
      decorationId: next.decorationId,
      current: { depthY: placement.depthY, ...(placement.collision ? { collision: placement.collision } : {}) },
      recommended: { depthY: next.depthY, collision: next.collision },
      depthChanged: placement.depthY !== next.depthY,
      collisionChanged
    };
    if (!review.depthChanged && !review.collisionChanged) throw new Error(`변경이 없는 Patch 전경입니다: ${key}`);
    reviewsByZone[next.zoneId] = [...(reviewsByZone[next.zoneId] ?? []), review];
    decisions[key] = "accepted";
  }
  return {
    patch,
    decisions,
    reviewsByZone,
    zoneIds: [...new Set([...proposed.values()].map(({ zoneId }) => zoneId))]
  };
}
