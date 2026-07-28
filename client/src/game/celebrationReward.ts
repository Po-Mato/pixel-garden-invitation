import {
  allCelebrationCollectibles,
  type CelebrationCollectible,
  type CelebrationCollectibleKind
} from "./celebrationCollectibles";
import type { WorldZone } from "./world";

export const celebrationRewardLabel = "축복의 꽃 정원 프레임";
export const celebrationKindRewards = {
  petal: {
    label: "꽃잎 발자국",
    detail: "걸을 때마다 부드러운 꽃잎 잔상이 따라와요."
  },
  ribbon: {
    label: "웨딩 리본 이름표",
    detail: "동행 이름표에 축하 리본 장식이 더해져요."
  },
  star: {
    label: "별빛 미니맵",
    detail: "미니맵 수집 표식이 더 선명하게 반짝여요."
  }
} as const satisfies Record<CelebrationCollectibleKind, { label: string; detail: string }>;

export type CelebrationMilestone =
  | {
    id: string;
    type: "kind";
    kind: CelebrationCollectibleKind;
    title: string;
    detail: string;
  }
  | {
    id: string;
    type: "zone";
    kind: CelebrationCollectibleKind;
    zoneId: WorldZone["id"];
    title: string;
    detail: string;
  };

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

export function celebrationKindRewardProgress(
  collectedIds: readonly string[],
  items: readonly CelebrationCollectible[] = allCelebrationCollectibles()
) {
  const collected = new Set(collectedIds);
  return (Object.keys(celebrationKindRewards) as CelebrationCollectibleKind[]).map((kind) => {
    const kindItems = items.filter((item) => item.kind === kind);
    const collectedCount = kindItems.filter(({ id }) => collected.has(id)).length;
    return {
      kind,
      collectedCount,
      totalCount: kindItems.length,
      unlocked: kindItems.length > 0 && collectedCount === kindItems.length,
      ...celebrationKindRewards[kind]
    };
  });
}

export function newlyUnlockedCelebrationMilestones(
  previousIds: readonly string[],
  nextIds: readonly string[],
  items: readonly CelebrationCollectible[],
  zones: readonly WorldZone[]
): CelebrationMilestone[] {
  const previous = new Set(previousIds);
  const next = new Set(nextIds);
  const unlocked: CelebrationMilestone[] = [];

  for (const reward of celebrationKindRewardProgress(nextIds, items)) {
    if (!reward.unlocked) continue;
    const wasUnlocked = items
      .filter(({ kind }) => kind === reward.kind)
      .every(({ id }) => previous.has(id));
    if (!wasUnlocked) {
      unlocked.push({
        id: `kind:${reward.kind}`,
        type: "kind",
        kind: reward.kind,
        title: `${reward.label} 획득`,
        detail: reward.detail
      });
    }
  }

  for (const zone of zones) {
    const zoneItems = items.filter(({ zoneId }) => zoneId === zone.id);
    if (zoneItems.length === 0 || !zoneItems.every(({ id }) => next.has(id))) continue;
    if (zoneItems.every(({ id }) => previous.has(id))) continue;
    const completedItem = zoneItems.find(({ id }) => !previous.has(id));
    unlocked.push({
      id: `zone:${zone.id}`,
      type: "zone",
      kind: completedItem?.kind ?? "star",
      zoneId: zone.id,
      title: `${zone.label} 축하 수집 완료`,
      detail: `${zoneItems.length}개의 축복을 모두 찾아 이 구역에 특별한 빛이 켜졌어요.`
    });
  }
  return unlocked;
}
