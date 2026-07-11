import {
  type CharacterAppearance,
  guestPresetFrame,
  resolveGuestPreset
} from "@wedding-game/shared";

export type CharacterDisplayMode = "world" | "thumbnail" | "preview";

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
  baseUrl = import.meta.env.BASE_URL,
  displayMode: CharacterDisplayMode = "world"
): ResolvedCharacterLayer[] {
  const preset = resolveGuestPreset(appearance);
  const useWorldPixels = displayMode === "world";
  return [{
    slot: "base",
    walkUrl: assetUrl(
      baseUrl,
      useWorldPixels ? `guests/world/${preset.id}__walk.png` : preset.generated.walk
    ),
    idleUrl: assetUrl(
      baseUrl,
      useWorldPixels ? `guests/world/${preset.id}__idle.png` : preset.generated.idle
    ),
    sourceSize: useWorldPixels ? guestPresetFrame.worldSource : guestPresetFrame.source,
    displaySize: guestPresetFrame.display
  }];
}
