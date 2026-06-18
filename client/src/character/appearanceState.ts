import {
  getDefaultAppearance,
  parseCharacterAppearance,
  resolveAppearanceOptions,
  type CharacterAppearance,
  type CharacterFamily
} from "@wedding-game/shared";

export function changeFamily(current: CharacterAppearance, family: CharacterFamily) {
  return current.family === family ? current : getDefaultAppearance(family);
}

export function updateAppearance(
  current: CharacterAppearance,
  patch: Partial<CharacterAppearance>
): CharacterAppearance {
  return parseCharacterAppearance({ ...current, ...patch }) ?? current;
}

export function randomizeAppearance(random = Math.random()): CharacterAppearance {
  const normalizedRandom = ((random % 1) + 1) % 1;
  const family: CharacterFamily = normalizedRandom < 0.5 ? "masculine" : "feminine";
  const options = resolveAppearanceOptions(family);
  const pick = <T>(items: T[], salt: number) =>
    items[Math.floor(((normalizedRandom + salt) % 1) * items.length)];
  const outfit = pick(options.outfits, 0.37);

  return {
    family,
    skinTone: pick(options.skinTones, 0.11).id,
    hairStyle: pick(options.hairStyles, 0.23).id,
    hairColor: pick(options.hairColors, 0.31).id,
    outfit: outfit.id,
    outfitPalette: pick(outfit.palettes, 0.43),
    accessories: {
      face: null,
      jewelry: null,
      neckwear: null,
      carry: null
    }
  };
}
