import type { JourneyCheckpointId } from "./journeyProgress";

export const journeyStampRewardStorageKey = "wedding-game:journey-stamp-reward:v1";

export const journeyStampRewardIds = [
  "none",
  "garden-map-pin",
  "gallery-ribbon",
  "bridal-corsage",
  "promise-tiara",
  "guestbook-sparkle"
] as const;

export type JourneyStampRewardId = (typeof journeyStampRewardIds)[number];

export type JourneyStampReward = {
  id: JourneyStampRewardId;
  checkpointId: JourneyCheckpointId | null;
  label: string;
  detail: string;
  unlockLabel: string;
};

export const journeyStampRewards: readonly JourneyStampReward[] = [
  {
    id: "none",
    checkpointId: null,
    label: "기본 모습",
    detail: "스탬프 장식 없이 캐릭터 본래 모습으로 돌아가요.",
    unlockLabel: "항상 사용 가능"
  },
  {
    id: "garden-map-pin",
    checkpointId: "directions",
    label: "정원 길잡이 핀",
    detail: "첫 길을 찾은 하객에게 건네는 작은 나침반 핀이에요.",
    unlockLabel: "오시는 길 스탬프"
  },
  {
    id: "gallery-ribbon",
    checkpointId: "gallery",
    label: "필름 리본",
    detail: "두 사람의 장면을 담은 로즈빛 필름 리본이에요.",
    unlockLabel: "웨딩 갤러리 스탬프"
  },
  {
    id: "bridal-corsage",
    checkpointId: "bride",
    label: "축하 코르사주",
    detail: "신부에게 전한 인사를 꽃잎 한 송이로 간직해요.",
    unlockLabel: "신부에게 인사 스탬프"
  },
  {
    id: "promise-tiara",
    checkpointId: "ceremony",
    label: "약속의 티아라",
    detail: "두 사람의 약속을 지켜본 순간 반짝이는 작은 관이에요.",
    unlockLabel: "예식홀 스탬프"
  },
  {
    id: "guestbook-sparkle",
    checkpointId: "guestbook",
    label: "마음별 장식",
    detail: "남긴 축하의 마음이 별빛처럼 캐릭터 곁에 머물러요.",
    unlockLabel: "축하 메시지 스탬프"
  }
] as const;

type RewardStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): RewardStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isJourneyStampRewardUnlocked(
  rewardId: JourneyStampRewardId,
  progress: { completedIds: readonly JourneyCheckpointId[] }
): boolean {
  const reward = journeyStampRewards.find(({ id }) => id === rewardId);
  return Boolean(reward && (reward.checkpointId === null || progress.completedIds.includes(reward.checkpointId)));
}

export function loadJourneyStampReward(storage: RewardStorage | null = browserStorage()): JourneyStampRewardId {
  try {
    const value = storage?.getItem(journeyStampRewardStorageKey);
    return journeyStampRewardIds.includes(value as JourneyStampRewardId)
      ? value as JourneyStampRewardId
      : "none";
  } catch {
    return "none";
  }
}

export function saveJourneyStampReward(
  rewardId: JourneyStampRewardId,
  storage: RewardStorage | null = browserStorage()
): boolean {
  if (!journeyStampRewardIds.includes(rewardId)) return false;
  try {
    storage?.setItem(journeyStampRewardStorageKey, rewardId);
    return Boolean(storage);
  } catch {
    return false;
  }
}
