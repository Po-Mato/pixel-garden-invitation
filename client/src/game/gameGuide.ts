import type { JourneyProgress } from "./journeyProgress";

export const gameGuideStorageKey = "wedding-game:first-visit-guide:v1";

export type GameGuideState = {
  version: 1;
  completed: boolean;
  completedAt: string | null;
};

type GuideStorage = Pick<Storage, "getItem" | "setItem">;

export function createGameGuideState(): GameGuideState {
  return { version: 1, completed: false, completedAt: null };
}

function browserStorage(): GuideStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadGameGuideState(storage: GuideStorage | null = browserStorage()): GameGuideState {
  if (!storage) return createGameGuideState();
  try {
    const parsed = JSON.parse(storage.getItem(gameGuideStorageKey) ?? "null") as Partial<GameGuideState> | null;
    if (!parsed || parsed.version !== 1 || parsed.completed !== true) return createGameGuideState();
    return {
      version: 1,
      completed: true,
      completedAt: typeof parsed.completedAt === "string" ? parsed.completedAt : null
    };
  } catch {
    return createGameGuideState();
  }
}

export function completeGameGuide(
  storage: GuideStorage | null = browserStorage(),
  completedAt = new Date().toISOString()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(gameGuideStorageKey, JSON.stringify({
      version: 1,
      completed: true,
      completedAt
    } satisfies GameGuideState));
    return true;
  } catch {
    return false;
  }
}

export function shouldAutoOpenGameGuide(guide: GameGuideState, progress: JourneyProgress): boolean {
  return !guide.completed && progress.completedIds.length === 0;
}
