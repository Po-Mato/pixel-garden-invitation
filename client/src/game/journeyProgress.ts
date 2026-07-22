import type { SpotId, WorldZoneId } from "@wedding-game/shared";

export const journeyProgressStorageKey = "wedding-game:journey-progress:v1";

export const journeyCheckpointIds = [
  "directions",
  "gallery",
  "bride",
  "ceremony",
  "guestbook"
] as const;

export type JourneyCheckpointId = (typeof journeyCheckpointIds)[number];

export type JourneyCheckpoint = {
  id: JourneyCheckpointId;
  label: string;
  detail: string;
  zoneId: WorldZoneId;
  target:
    | { type: "spot"; spotId: SpotId }
    | { type: "npc"; npcId: "bride" }
    | { type: "zone" };
};

export type JourneyProgress = {
  version: 1;
  completedIds: JourneyCheckpointId[];
  updatedAt: string | null;
};

type JourneyStorage = Pick<Storage, "getItem" | "setItem">;

export const journeyCheckpoints: readonly JourneyCheckpoint[] = [
  {
    id: "directions",
    label: "오시는 길",
    detail: "예식장으로 향하는 길 확인",
    zoneId: "home",
    target: { type: "spot", spotId: "directions" }
  },
  {
    id: "gallery",
    label: "웨딩 갤러리",
    detail: "두 사람의 사진 감상",
    zoneId: "lobby",
    target: { type: "spot", spotId: "gallery" }
  },
  {
    id: "bride",
    label: "신부에게 인사",
    detail: "대기실에서 축하 인사",
    zoneId: "bridal-room",
    target: { type: "npc", npcId: "bride" }
  },
  {
    id: "ceremony",
    label: "예식홀",
    detail: "두 사람의 약속 자리 방문",
    zoneId: "ceremony-hall",
    target: { type: "zone" }
  },
  {
    id: "guestbook",
    label: "축하 메시지",
    detail: "연회장에서 마음 남기기",
    zoneId: "banquet",
    target: { type: "spot", spotId: "guestbook" }
  }
] as const;

const validCheckpointIds = new Set<string>(journeyCheckpointIds);

export function createEmptyJourneyProgress(): JourneyProgress {
  return { version: 1, completedIds: [], updatedAt: null };
}

function browserStorage(): JourneyStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadJourneyProgress(storage: JourneyStorage | null = browserStorage()): JourneyProgress {
  if (!storage) return createEmptyJourneyProgress();

  try {
    const raw = storage.getItem(journeyProgressStorageKey);
    if (!raw) return createEmptyJourneyProgress();
    const parsed = JSON.parse(raw) as Partial<JourneyProgress>;
    const completedIds = Array.isArray(parsed.completedIds)
      ? journeyCheckpointIds.filter((id) => parsed.completedIds?.includes(id))
      : [];

    return {
      version: 1,
      completedIds,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null
    };
  } catch {
    return createEmptyJourneyProgress();
  }
}

export function saveJourneyProgress(
  progress: JourneyProgress,
  storage: JourneyStorage | null = browserStorage()
): boolean {
  if (!storage) return false;

  try {
    storage.setItem(journeyProgressStorageKey, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function completeJourneyCheckpoint(
  progress: JourneyProgress,
  checkpointId: JourneyCheckpointId,
  updatedAt = new Date().toISOString()
): { progress: JourneyProgress; changed: boolean; journeyCompleted: boolean } {
  if (progress.completedIds.includes(checkpointId)) {
    return {
      progress,
      changed: false,
      journeyCompleted: progress.completedIds.length === journeyCheckpointIds.length
    };
  }

  const completed = new Set([...progress.completedIds, checkpointId]);
  const nextProgress: JourneyProgress = {
    version: 1,
    completedIds: journeyCheckpointIds.filter((id) => completed.has(id)),
    updatedAt
  };

  return {
    progress: nextProgress,
    changed: true,
    journeyCompleted: nextProgress.completedIds.length === journeyCheckpointIds.length
  };
}

export function journeyCheckpointForInteraction(
  zoneId: WorldZoneId,
  spotId: SpotId
): JourneyCheckpointId | null {
  if (spotId === "directions") return "directions";
  if (zoneId === "lobby" && spotId === "gallery") return "gallery";
  if (zoneId === "bridal-room" && spotId === "couple") return "bride";
  if (zoneId === "banquet" && spotId === "guestbook") return "guestbook";
  return null;
}

export function journeyCheckpointForZone(zoneId: WorldZoneId): JourneyCheckpointId | null {
  return zoneId === "ceremony-hall" ? "ceremony" : null;
}

export function isJourneyCheckpointId(value: unknown): value is JourneyCheckpointId {
  return typeof value === "string" && validCheckpointIds.has(value);
}
