import {
  parseCharacterAppearance,
  type CharacterAppearance
} from "@wedding-game/shared";

const storageKey = "pixel-garden-character-v1";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  const storage = window.localStorage;
  return typeof storage?.getItem === "function" && typeof storage?.setItem === "function"
    ? storage
    : null;
}

export function loadAppearance(): CharacterAppearance | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const parsed = parseCharacterAppearance(JSON.parse(raw));
    if (!parsed) storage.removeItem(storageKey);
    storage.setItem(storageKey, JSON.stringify(parsed));
    return parsed;
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}

export function saveAppearance(appearance: CharacterAppearance) {
  getStorage()?.setItem(storageKey, JSON.stringify(appearance));
}
