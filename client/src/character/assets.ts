import {
  type CharacterAppearance,
  guestPresetFrame,
  resolveGuestPreset
} from "@wedding-game/shared";

export type CharacterDisplayMode = "world" | "preview";

export type ResolvedCharacterLayer = {
  slot: "base";
  walkUrl: string;
  idleUrl?: string;
  sourceSize: { width: number; height: number };
  displaySize: Record<CharacterDisplayMode, { width: number; height: number }>;
};

const assetUrl = (baseUrl: string, path: string) =>
  `${baseUrl}characters/generated/${path}`;

export function resolveCharacterLayers(
  appearance: CharacterAppearance,
  baseUrl = import.meta.env.BASE_URL
): ResolvedCharacterLayer[] {
  const preset = resolveGuestPreset(appearance);
  return [{
    slot: "base",
    walkUrl: assetUrl(baseUrl, preset.generated.walk),
    idleUrl: assetUrl(baseUrl, preset.generated.idle),
    sourceSize: guestPresetFrame.source,
    displaySize: guestPresetFrame.display
  }];
}
