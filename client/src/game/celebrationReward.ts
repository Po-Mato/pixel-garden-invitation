import { allCelebrationCollectibles } from "./celebrationCollectibles";

export const celebrationRewardLabel = "축복의 꽃 정원 프레임";

export function celebrationRewardProgress(
  collectedIds: readonly string[],
  totalCount = allCelebrationCollectibles().length
) {
  const collectedCount = Math.min(new Set(collectedIds).size, totalCount);
  return {
    collectedCount,
    totalCount,
    remainingCount: Math.max(0, totalCount - collectedCount),
    unlocked: totalCount > 0 && collectedCount >= totalCount
  };
}
