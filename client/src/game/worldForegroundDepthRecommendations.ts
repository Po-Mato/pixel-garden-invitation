import type { WorldZoneId } from "@wedding-game/shared";
import recommendationData from "./worldForegroundDepthRecommendations.json";

type ForegroundDepthRecommendation = {
  decorationId: string;
  depthY: number;
};

export const worldForegroundDepthRecommendations = recommendationData.zones as Record<
  WorldZoneId,
  ForegroundDepthRecommendation[]
>;

export function recommendedForegroundDepthY(zoneId: WorldZoneId, decorationId: string): number | null {
  return worldForegroundDepthRecommendations[zoneId]
    .find((recommendation) => recommendation.decorationId === decorationId)?.depthY ?? null;
}
