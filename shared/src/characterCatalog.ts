import rawCatalog from "../character-catalog.json";
import {
  type CharacterFamily,
  getDefaultPresetId,
  guestCharacterPresets,
  isGuestPresetId
} from "./guestCharacterPresets";

export type { CharacterFamily };

export type CharacterAppearance = {
  presetId: string;
};

type LegacyCharacterCatalog = {
  version: number;
  npcs: Array<{ id: "groom" | "bride"; label: string }>;
};

export const characterCatalog = {
  ...(rawCatalog as LegacyCharacterCatalog),
  guestPresets: guestCharacterPresets
};

export function getDefaultAppearance(family?: CharacterFamily): CharacterAppearance {
  return { presetId: getDefaultPresetId(family) };
}

export const defaultCharacterAppearance = getDefaultAppearance();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseCharacterAppearance(value: unknown): CharacterAppearance {
  if (isRecord(value) && isGuestPresetId(value.presetId)) {
    return { presetId: value.presetId };
  }

  if (isRecord(value) && (value.family === "masculine" || value.family === "feminine")) {
    return getDefaultAppearance(value.family);
  }

  return defaultCharacterAppearance;
}
