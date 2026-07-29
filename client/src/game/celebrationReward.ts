import {
  allCelebrationCollectibles,
  type CelebrationCollectible,
  type CelebrationCollectibleKind
} from "./celebrationCollectibles";
import type { CharacterAppearance } from "@wedding-game/shared";
import type { WorldZone } from "./world";

export const celebrationRewardLabel = "축복의 꽃 정원 프레임";
export const celebrationCosmeticStorageKey = "wedding-game:celebration-cosmetic:v1";
export const celebrationCosmeticToneStorageKey = "wedding-game:celebration-cosmetic-tone:v1";
export const celebrationCosmeticIds = ["none", "petal-trail", "ribbon-tag", "starlight-aura", "garden-blessing-set"] as const;
export type CelebrationCosmeticId = (typeof celebrationCosmeticIds)[number];
export const celebrationCosmeticTones = ["rose", "gold", "sage"] as const;
export type CelebrationCosmeticTone = (typeof celebrationCosmeticTones)[number];
export const celebrationCosmeticToneLabels: Record<CelebrationCosmeticTone, string> = {
  rose: "블러시 로즈",
  gold: "샴페인 골드",
  sage: "가든 세이지"
};
export const celebrationKindRewards = {
  petal: {
    label: "꽃잎 발자국",
    detail: "걸을 때마다 부드러운 꽃잎 잔상이 따라와요.",
    cosmeticId: "petal-trail"
  },
  ribbon: {
    label: "웨딩 리본 이름표",
    detail: "동행 이름표에 축하 리본 장식이 더해져요.",
    cosmeticId: "ribbon-tag"
  },
  star: {
    label: "별빛 오라",
    detail: "캐릭터 둘레에 은은한 별빛이 반짝여요.",
    cosmeticId: "starlight-aura"
  }
} as const satisfies Record<CelebrationCollectibleKind, {
  label: string;
  detail: string;
  cosmeticId: Exclude<CelebrationCosmeticId, "none">;
}>;

export const celebrationSetReward = {
  label: "웨딩 가든 축복 세트",
  detail: "꽃잎 발자국·리본 이름표·별빛 오라가 하나의 축복 효과로 어우러져요.",
  cosmeticId: "garden-blessing-set"
} as const;

type CosmeticStorage = Pick<Storage, "getItem" | "setItem">;

function browserCosmeticStorage(): CosmeticStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadCelebrationCosmetic(
  storage: CosmeticStorage | null = browserCosmeticStorage()
): CelebrationCosmeticId {
  try {
    const stored = storage?.getItem(celebrationCosmeticStorageKey);
    return celebrationCosmeticIds.includes(stored as CelebrationCosmeticId)
      ? stored as CelebrationCosmeticId
      : "none";
  } catch {
    return "none";
  }
}

export function saveCelebrationCosmetic(
  cosmeticId: CelebrationCosmeticId,
  storage: CosmeticStorage | null = browserCosmeticStorage()
) {
  if (!celebrationCosmeticIds.includes(cosmeticId)) return false;
  try {
    storage?.setItem(celebrationCosmeticStorageKey, cosmeticId);
    return storage !== null;
  } catch {
    return false;
  }
}

export function loadCelebrationCosmeticTone(
  storage: CosmeticStorage | null = browserCosmeticStorage()
): CelebrationCosmeticTone {
  try {
    const stored = storage?.getItem(celebrationCosmeticToneStorageKey);
    return celebrationCosmeticTones.includes(stored as CelebrationCosmeticTone)
      ? stored as CelebrationCosmeticTone
      : "rose";
  } catch {
    return "rose";
  }
}

export function saveCelebrationCosmeticTone(
  tone: CelebrationCosmeticTone,
  storage: CosmeticStorage | null = browserCosmeticStorage()
) {
  if (!celebrationCosmeticTones.includes(tone)) return false;
  try {
    storage?.setItem(celebrationCosmeticToneStorageKey, tone);
    return storage !== null;
  } catch {
    return false;
  }
}

export type CelebrationCosmeticRecommendation = {
  cosmeticId: CelebrationCosmeticId;
  cosmeticLabel: string;
  tone: CelebrationCosmeticTone;
  toneLabel: string;
  detail: string;
};

export function celebrationCosmeticRecommendation(
  appearance: CharacterAppearance,
  collectedIds: readonly string[],
  items: readonly CelebrationCollectible[] = allCelebrationCollectibles()
): CelebrationCosmeticRecommendation {
  const presetId = appearance.presetId;
  const coolFormal = /navy|charcoal|blue/.test(presetId);
  const naturalLight = /sage|green|beige|cream|long-wave/.test(presetId);
  const tone: CelebrationCosmeticTone = coolFormal ? "gold" : naturalLight ? "rose" : "sage";
  const preferredId: CelebrationCosmeticId = coolFormal
    ? "starlight-aura"
    : naturalLight ? "petal-trail" : "ribbon-tag";
  const unlockedRewards = celebrationKindRewardProgress(collectedIds, items).filter(({ unlocked }) => unlocked);
  const preferred = unlockedRewards.find(({ cosmeticId }) => cosmeticId === preferredId) ?? unlockedRewards[0];
  const cosmeticId = preferred?.cosmeticId ?? "none";
  const cosmeticLabel = preferred?.label ?? "기본 모습";
  const detail = coolFormal
    ? "짙은 수트와 네이비 계열에는 따뜻한 골드 빛이 윤곽을 또렷하게 살려줘요."
    : naturalLight
      ? "크림·베이지·세이지 계열에는 로즈 꽃잎이 화사한 대비를 더해줘요."
      : "로즈·라벤더 계열 의상에는 세이지 장식이 차분한 균형을 만들어줘요.";
  return {
    cosmeticId,
    cosmeticLabel,
    tone,
    toneLabel: celebrationCosmeticToneLabels[tone],
    detail
  };
}

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

export function celebrationSetRewardProgress(
  collectedIds: readonly string[],
  items: readonly CelebrationCollectible[] = allCelebrationCollectibles()
) {
  const kindRewards = celebrationKindRewardProgress(collectedIds, items);
  return {
    ...celebrationSetReward,
    completedCount: kindRewards.filter(({ unlocked }) => unlocked).length,
    totalCount: kindRewards.length,
    unlocked: kindRewards.length > 0 && kindRewards.every(({ unlocked }) => unlocked)
  };
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
