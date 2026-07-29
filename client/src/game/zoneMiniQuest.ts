import type { SpotId, WorldZoneId } from "@wedding-game/shared";
import type { NpcId } from "./npcDialogue";
import type { WorldPhotoSpotId } from "./world";

export const zoneMiniQuestStorageKey = "wedding-game:zone-mini-quest:v1";

export type ZoneMiniQuestAction =
  | { type: "spot"; id: SpotId }
  | { type: "photo"; id: WorldPhotoSpotId }
  | { type: "npc"; id: NpcId }
  | { type: "portal"; id: string };

export type ZoneMiniQuestStep = {
  id: string;
  label: string;
  actionLabel: string;
  target: ZoneMiniQuestAction | { type: "npc"; id: "either" };
};

export type ZoneMiniQuestDefinition = {
  zoneId: WorldZoneId;
  title: string;
  steps: readonly ZoneMiniQuestStep[];
};

export type ZoneMiniQuestProgress = {
  version: 1;
  completedStepIds: string[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const zoneMiniQuests: readonly ZoneMiniQuestDefinition[] = [
  { zoneId: "home", title: "출발 준비", steps: [
    { id: "home-directions", label: "오시는 길", actionLabel: "확인", target: { type: "spot", id: "directions" } },
    { id: "home-exit", label: "동네로 출발", actionLabel: "이동", target: { type: "portal", id: "home-to-neighborhood" } }
  ] },
  { zoneId: "neighborhood", title: "역으로 가는 길", steps: [
    { id: "neighborhood-station", label: "지하철역 입구 찾기", actionLabel: "안내", target: { type: "portal", id: "neighborhood-to-station" } }
  ] },
  { zoneId: "subway-station", title: "승강장 이동", steps: [
    { id: "station-directions", label: "노선 안내", actionLabel: "확인", target: { type: "spot", id: "directions" } },
    { id: "station-train", label: "열차 탑승", actionLabel: "이동", target: { type: "portal", id: "station-to-train" } }
  ] },
  { zoneId: "subway-train", title: "예식장으로", steps: [
    { id: "train-venue", label: "예식장역에서 내리기", actionLabel: "이동", target: { type: "portal", id: "train-to-venue" } }
  ] },
  { zoneId: "venue-exterior", title: "예식장 도착", steps: [
    { id: "venue-lobby", label: "로비로 들어가기", actionLabel: "이동", target: { type: "portal", id: "venue-to-lobby" } }
  ] },
  { zoneId: "lobby", title: "로비 둘러보기", steps: [
    { id: "lobby-info", label: "예식 안내", actionLabel: "확인", target: { type: "spot", id: "wedding-info" } },
    { id: "lobby-gallery", label: "웨딩 갤러리", actionLabel: "감상", target: { type: "spot", id: "gallery" } },
    { id: "lobby-photo", label: "로비 포토월", actionLabel: "촬영", target: { type: "photo", id: "lobby-photo-wall" } }
  ] },
  { zoneId: "bridal-room", title: "신부 대기실", steps: [
    { id: "bridal-greeting", label: "신부에게 축하 인사", actionLabel: "대화", target: { type: "npc", id: "bride" } },
    { id: "bridal-photo", label: "꽃벽 기념사진", actionLabel: "촬영", target: { type: "photo", id: "bridal-flower-wall" } },
    { id: "bridal-return", label: "로비로 돌아가기", actionLabel: "이동", target: { type: "portal", id: "bridal-to-lobby" } }
  ] },
  { zoneId: "ceremony-hall", title: "예식홀 축하", steps: [
    { id: "hall-greeting", label: "두 사람에게 인사", actionLabel: "대화", target: { type: "npc", id: "either" } },
    { id: "hall-photo", label: "버진로드 기념사진", actionLabel: "촬영", target: { type: "photo", id: "ceremony-aisle" } }
  ] },
  { zoneId: "banquet", title: "연회 즐기기", steps: [
    { id: "banquet-guestbook", label: "축하 메시지 남기기", actionLabel: "작성", target: { type: "spot", id: "guestbook" } },
    { id: "banquet-restroom", label: "편의 공간 확인", actionLabel: "이동", target: { type: "portal", id: "banquet-to-restroom" } }
  ] },
  { zoneId: "restroom", title: "잠시 정돈하기", steps: [
    { id: "restroom-return", label: "연회장으로 돌아가기", actionLabel: "이동", target: { type: "portal", id: "restroom-to-banquet" } }
  ] }
] as const;

const validStepIds = new Set(zoneMiniQuests.flatMap(({ steps }) => steps.map(({ id }) => id)));

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createEmptyZoneMiniQuestProgress(): ZoneMiniQuestProgress {
  return { version: 1, completedStepIds: [] };
}

export function loadZoneMiniQuestProgress(storage: StorageLike | null = browserStorage()): ZoneMiniQuestProgress {
  try {
    const raw = storage?.getItem(zoneMiniQuestStorageKey);
    if (!raw) return createEmptyZoneMiniQuestProgress();
    const parsed = JSON.parse(raw) as Partial<ZoneMiniQuestProgress>;
    const completed = Array.isArray(parsed.completedStepIds)
      ? parsed.completedStepIds.filter((id): id is string => typeof id === "string" && validStepIds.has(id))
      : [];
    return { version: 1, completedStepIds: [...new Set(completed)] };
  } catch {
    return createEmptyZoneMiniQuestProgress();
  }
}

export function saveZoneMiniQuestProgress(
  progress: ZoneMiniQuestProgress,
  storage: StorageLike | null = browserStorage()
): boolean {
  try {
    storage?.setItem(zoneMiniQuestStorageKey, JSON.stringify(progress));
    return storage !== null;
  } catch {
    return false;
  }
}

export function zoneMiniQuestFor(zoneId: WorldZoneId): ZoneMiniQuestDefinition {
  return zoneMiniQuests.find((quest) => quest.zoneId === zoneId)!;
}

export function currentZoneMiniQuestStep(
  quest: ZoneMiniQuestDefinition,
  progress: ZoneMiniQuestProgress
): ZoneMiniQuestStep | null {
  const completed = new Set(progress.completedStepIds);
  return quest.steps.find(({ id }) => !completed.has(id)) ?? null;
}

export function completedZoneMiniQuestStepCount(
  quest: ZoneMiniQuestDefinition,
  progress: ZoneMiniQuestProgress
): number {
  const completed = new Set(progress.completedStepIds);
  return quest.steps.filter(({ id }) => completed.has(id)).length;
}

export function zoneMiniQuestStepMatches(step: ZoneMiniQuestStep, action: ZoneMiniQuestAction): boolean {
  if (step.target.type !== action.type) return false;
  if (step.target.type === "npc" && step.target.id === "either") return true;
  return step.target.id === action.id;
}

export function completeCurrentZoneMiniQuestStep(
  progress: ZoneMiniQuestProgress,
  zoneId: WorldZoneId,
  action: ZoneMiniQuestAction
): { progress: ZoneMiniQuestProgress; changed: boolean; completedStep: ZoneMiniQuestStep | null } {
  const quest = zoneMiniQuestFor(zoneId);
  const current = currentZoneMiniQuestStep(quest, progress);
  if (!current || !zoneMiniQuestStepMatches(current, action)) {
    return { progress, changed: false, completedStep: null };
  }
  return {
    progress: { version: 1, completedStepIds: [...progress.completedStepIds, current.id] },
    changed: true,
    completedStep: current
  };
}
