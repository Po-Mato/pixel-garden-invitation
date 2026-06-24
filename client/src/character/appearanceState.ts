import {
  defaultCharacterAppearance,
  guestCharacterPresets,
  isGuestPresetId,
  type CharacterAppearance
} from "@wedding-game/shared";

export function updateAppearance(
  current: CharacterAppearance,
  presetId: string
): CharacterAppearance {
  return isGuestPresetId(presetId) ? { presetId } : current;
}

export function randomizeAppearance(random = Math.random()): CharacterAppearance {
  const normalizedRandom = ((random % 1) + 1) % 1;
  const preset = guestCharacterPresets[Math.floor(normalizedRandom * guestCharacterPresets.length)];
  return preset ? { presetId: preset.id } : defaultCharacterAppearance;
}
