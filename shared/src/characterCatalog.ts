import rawCatalog from "../character-catalog.json";

export type CharacterFamily = "masculine" | "feminine";
export type AccessorySlot = "face" | "jewelry" | "neckwear" | "carry";

export type CharacterAppearance = {
  family: CharacterFamily;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  outfit: string;
  outfitPalette: string;
  accessories: Record<AccessorySlot, string | null>;
};

type FamilyItem = { id: string; family: CharacterFamily; label: string };
type OutfitItem = FamilyItem & { palettes: string[] };
export type CharacterLayerSlot =
  | "back-accessory"
  | "back-hair"
  | "base"
  | "outfit"
  | "front-hair"
  | "face"
  | "jewelry"
  | "neckwear"
  | "carry";

type AccessoryItem = {
  id: string;
  slot: AccessorySlot;
  layer: CharacterLayerSlot;
  label: string;
};

export const characterCatalog = rawCatalog as {
  version: number;
  skinTones: Array<{ id: string; label: string }>;
  hairColors: Array<{ id: string; label: string }>;
  hairStyles: FamilyItem[];
  outfits: OutfitItem[];
  accessories: AccessoryItem[];
  defaults: Record<CharacterFamily, Omit<CharacterAppearance, "family" | "accessories">>;
  npcs: Array<{ id: "groom" | "bride"; label: string }>;
};

const emptyAccessories = (): CharacterAppearance["accessories"] => ({
  face: null,
  jewelry: null,
  neckwear: null,
  carry: null
});

export function getDefaultAppearance(family: CharacterFamily): CharacterAppearance {
  return {
    family,
    ...characterCatalog.defaults[family],
    accessories: emptyAccessories()
  };
}

export const defaultCharacterAppearance = getDefaultAppearance("feminine");

export function resolveAppearanceOptions(family: CharacterFamily) {
  return {
    skinTones: characterCatalog.skinTones,
    hairColors: characterCatalog.hairColors,
    hairStyles: characterCatalog.hairStyles.filter((item) => item.family === family),
    outfits: characterCatalog.outfits.filter((item) => item.family === family),
    accessories: characterCatalog.accessories
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseCharacterAppearance(value: unknown): CharacterAppearance | null {
  if (!isRecord(value) || (value.family !== "masculine" && value.family !== "feminine")) return null;

  const options = resolveAppearanceOptions(value.family);
  const outfit = options.outfits.find((item) => item.id === value.outfit);
  if (!options.skinTones.some((item) => item.id === value.skinTone)) return null;
  if (!options.hairColors.some((item) => item.id === value.hairColor)) return null;
  if (!options.hairStyles.some((item) => item.id === value.hairStyle)) return null;
  if (!outfit || !outfit.palettes.includes(value.outfitPalette as string)) return null;
  if (!isRecord(value.accessories)) return null;

  const accessories = emptyAccessories();
  for (const slot of Object.keys(accessories) as AccessorySlot[]) {
    const selected = value.accessories[slot];
    if (selected === null) continue;
    if (typeof selected !== "string") return null;
    if (!options.accessories.some((item) => item.id === selected && item.slot === slot)) return null;
    accessories[slot] = selected;
  }

  return {
    family: value.family,
    skinTone: value.skinTone as string,
    hairStyle: value.hairStyle as string,
    hairColor: value.hairColor as string,
    outfit: value.outfit as string,
    outfitPalette: value.outfitPalette as string,
    accessories
  };
}
