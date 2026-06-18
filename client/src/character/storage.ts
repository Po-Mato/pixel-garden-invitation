import {
  parseCharacterAppearance,
  type CharacterAppearance
} from "@wedding-game/shared";

const storageKey = "pixel-garden-character-v1";

export function loadAppearance(): CharacterAppearance | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = parseCharacterAppearance(JSON.parse(raw));
    if (!parsed) window.localStorage.removeItem(storageKey);
    return parsed;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function saveAppearance(appearance: CharacterAppearance) {
  window.localStorage.setItem(storageKey, JSON.stringify(appearance));
}
