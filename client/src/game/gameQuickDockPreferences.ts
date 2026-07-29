export const gameQuickDockStorageKey = "wedding-game-quick-dock:v1";

export const gameQuickDockActions = ["reaction", "guide", "journey", "sound"] as const;
export type GameQuickDockAction = typeof gameQuickDockActions[number];

export const defaultGameQuickDockActions: readonly GameQuickDockAction[] = ["reaction", "guide"];

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeGameQuickDockActions(value: unknown): GameQuickDockAction[] {
  if (!Array.isArray(value)) return [...defaultGameQuickDockActions];
  const unique = value.filter((item, index): item is GameQuickDockAction => (
    typeof item === "string"
    && gameQuickDockActions.includes(item as GameQuickDockAction)
    && value.indexOf(item) === index
  ));
  return unique.length > 0 ? unique.slice(0, 2) : [...defaultGameQuickDockActions];
}

export function toggleGameQuickDockAction(
  current: readonly GameQuickDockAction[],
  action: GameQuickDockAction
): GameQuickDockAction[] {
  if (current.includes(action)) {
    return current.length === 1 ? [...current] : current.filter((item) => item !== action);
  }
  return current.length < 2 ? [...current, action] : [current[1], action];
}

export function loadGameQuickDockActions(storage: StorageLike | null = browserStorage()): GameQuickDockAction[] {
  try {
    const value = storage?.getItem(gameQuickDockStorageKey);
    return value ? normalizeGameQuickDockActions(JSON.parse(value)) : [...defaultGameQuickDockActions];
  } catch {
    return [...defaultGameQuickDockActions];
  }
}

export function saveGameQuickDockActions(
  actions: readonly GameQuickDockAction[],
  storage: StorageLike | null = browserStorage()
): boolean {
  try {
    storage?.setItem(gameQuickDockStorageKey, JSON.stringify(normalizeGameQuickDockActions(actions)));
    return storage !== null;
  } catch {
    return false;
  }
}
