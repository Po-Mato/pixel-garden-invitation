import { parseCharacterAppearance, type CharacterAppearance } from "@wedding-game/shared";

export const gameEntrySessionStorageKey = "wedding-game:entry-session:v1";

export type GameEntrySession = {
  version: 1;
  nickname: string;
  appearance: CharacterAppearance;
  updatedAt: string;
};

type GameEntryStorage = Pick<Storage, "getItem" | "setItem">;
const sessionMaxAgeMs = 30 * 24 * 60 * 60 * 1000;

function browserStorage(): GameEntryStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadGameEntrySession(
  storage: GameEntryStorage | null = browserStorage(),
  now = Date.now()
): GameEntrySession | null {
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(gameEntrySessionStorageKey) ?? "null") as Partial<GameEntrySession> | null;
    if (!parsed || typeof parsed.nickname !== "string" || !parsed.nickname.trim() || typeof parsed.updatedAt !== "string") {
      return null;
    }
    const updatedAt = Date.parse(parsed.updatedAt);
    if (!Number.isFinite(updatedAt) || now - updatedAt > sessionMaxAgeMs) return null;
    return {
      version: 1,
      nickname: parsed.nickname.trim().slice(0, 20),
      appearance: parseCharacterAppearance(parsed.appearance),
      updatedAt: parsed.updatedAt
    };
  } catch {
    return null;
  }
}

export function saveGameEntrySession(
  profile: Pick<GameEntrySession, "nickname" | "appearance">,
  storage: GameEntryStorage | null = browserStorage(),
  updatedAt = new Date().toISOString()
): boolean {
  if (!storage || !profile.nickname.trim()) return false;
  try {
    storage.setItem(gameEntrySessionStorageKey, JSON.stringify({
      version: 1,
      nickname: profile.nickname.trim().slice(0, 20),
      appearance: parseCharacterAppearance(profile.appearance),
      updatedAt
    }));
    return true;
  } catch {
    return false;
  }
}
