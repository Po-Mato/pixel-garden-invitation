import type { WorldZoneId } from "@wedding-game/shared";
import recommendationData from "./worldForegroundRecommendations.json";
import {
  worldForegroundPlacements,
  type Rect,
  type WorldForegroundPlacement
} from "./world";

export type ForegroundRecommendationDecision = "pending" | "accepted" | "rejected";

export type WorldForegroundRecommendation = {
  decorationId: string;
  depthY: number;
  collision: Rect | null;
};

export type WorldForegroundRecommendationReview = {
  key: string;
  zoneId: WorldZoneId;
  decorationId: string;
  current: Pick<WorldForegroundPlacement, "depthY" | "collision">;
  recommended: Pick<WorldForegroundRecommendation, "depthY" | "collision">;
  depthChanged: boolean;
  collisionChanged: boolean;
};

export type ForegroundGeometryDeltaIntensity = "low" | "medium" | "high";

export type WorldForegroundJsonPatchOperation = {
  op: "add" | "remove" | "replace";
  path: string;
  value?: number | Rect;
};

export type WorldForegroundRecommendationPatch = {
  version: 1;
  target: "client/src/game/worldForegroundPlacements.json";
  sourceContractVersion: number;
  sourceChecksum: string;
  generatedAt: string;
  acceptedPlacementKeys: string[];
  operationCount: number;
  operations: WorldForegroundJsonPatchOperation[];
};

export const worldForegroundPlacementTarget = "client/src/game/worldForegroundPlacements.json" as const;
export const worldForegroundSourceContractVersion = recommendationData.version;
export const worldForegroundSourceChecksum = recommendationData.sourceChecksum;

export const worldForegroundRecommendations = recommendationData.zones as Record<
  WorldZoneId,
  WorldForegroundRecommendation[]
>;

export function worldForegroundRecommendationKey(zoneId: WorldZoneId, decorationId: string): string {
  return `${zoneId}/${decorationId}`;
}

function sameRect(left: Rect | null | undefined, right: Rect | null | undefined): boolean {
  if (!left || !right) return !left && !right;
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height;
}

export function foregroundRecommendationReviewsForZone(
  zoneId: WorldZoneId
): WorldForegroundRecommendationReview[] {
  const recommendations = new Map(
    worldForegroundRecommendations[zoneId].map((recommendation) => [recommendation.decorationId, recommendation])
  );
  return worldForegroundPlacements[zoneId].flatMap((placement) => {
    const recommendation = recommendations.get(placement.decorationId);
    if (!recommendation) return [];
    const depthChanged = placement.depthY !== recommendation.depthY;
    const collisionChanged = !sameRect(placement.collision, recommendation.collision);
    if (!depthChanged && !collisionChanged) return [];
    return [{
      key: worldForegroundRecommendationKey(zoneId, placement.decorationId),
      zoneId,
      decorationId: placement.decorationId,
      current: { depthY: placement.depthY, collision: placement.collision },
      recommended: { depthY: recommendation.depthY, collision: recommendation.collision },
      depthChanged,
      collisionChanged
    }];
  });
}

export function recommendedForegroundGeometry(
  zoneId: WorldZoneId,
  decorationId: string
): WorldForegroundRecommendation | null {
  return worldForegroundRecommendations[zoneId]
    .find((recommendation) => recommendation.decorationId === decorationId) ?? null;
}

export function foregroundGeometryDeltaScore(review: WorldForegroundRecommendationReview): number {
  const current = review.current.collision;
  const recommended = review.recommended.collision;
  const collisionScore = current && recommended
    ? Math.abs(current.x - recommended.x)
      + Math.abs(current.y - recommended.y)
      + Math.abs(current.width - recommended.width)
      + Math.abs(current.height - recommended.height)
    : current || recommended ? 160 : 0;
  return Math.abs(review.current.depthY - review.recommended.depthY) * 2 + collisionScore;
}

export function foregroundGeometryDeltaIntensity(
  review: WorldForegroundRecommendationReview
): ForegroundGeometryDeltaIntensity {
  const score = foregroundGeometryDeltaScore(review);
  return score >= 100 ? "high" : score >= 36 ? "medium" : "low";
}

export function buildWorldForegroundRecommendationPatch(
  decisions: Partial<Record<string, ForegroundRecommendationDecision>>,
  generatedAt = new Date().toISOString()
): WorldForegroundRecommendationPatch {
  const acceptedPlacementKeys: string[] = [];
  const operations: WorldForegroundJsonPatchOperation[] = [];

  for (const [zoneId, placements] of Object.entries(worldForegroundPlacements) as Array<[
    WorldZoneId,
    WorldForegroundPlacement[]
  ]>) {
    const recommendations = new Map(
      worldForegroundRecommendations[zoneId].map((recommendation) => [recommendation.decorationId, recommendation])
    );
    placements.forEach((placement, index) => {
      const key = worldForegroundRecommendationKey(zoneId, placement.decorationId);
      if (decisions[key] !== "accepted") return;
      const recommendation = recommendations.get(placement.decorationId);
      if (!recommendation) return;
      const basePath = `/zones/${zoneId}/${index}`;
      const operationStart = operations.length;
      if (placement.depthY !== recommendation.depthY) {
        operations.push({ op: "replace", path: `${basePath}/depthY`, value: recommendation.depthY });
      }
      if (!sameRect(placement.collision, recommendation.collision)) {
        if (!placement.collision && recommendation.collision) {
          operations.push({ op: "add", path: `${basePath}/collision`, value: recommendation.collision });
        } else if (placement.collision && !recommendation.collision) {
          operations.push({ op: "remove", path: `${basePath}/collision` });
        } else if (recommendation.collision) {
          operations.push({ op: "replace", path: `${basePath}/collision`, value: recommendation.collision });
        }
      }
      if (operations.length > operationStart) acceptedPlacementKeys.push(key);
    });
  }

  return {
    version: 1,
    target: worldForegroundPlacementTarget,
    sourceContractVersion: worldForegroundSourceContractVersion,
    sourceChecksum: worldForegroundSourceChecksum,
    generatedAt,
    acceptedPlacementKeys,
    operationCount: operations.length,
    operations
  };
}
