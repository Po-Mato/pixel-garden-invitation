import {
  defaultCharacterAppearance,
  type CharacterAppearance,
  guestPresetFrame,
  resolveGuestPreset
} from "@wedding-game/shared";

export type CharacterDisplayMode = "world" | "thumbnail" | "preview";

export type ResolvedCharacterLayer = {
  slot: "base";
  walkUrl: string;
  idleUrl?: string;
  fallbackWalkUrl: string;
  fallbackIdleUrl?: string;
  sourceSize: { width: number; height: number };
  displaySize: Record<CharacterDisplayMode, { width: number; height: number }>;
};

const assetUrl = (baseUrl: string, path: string) =>
  `${baseUrl}characters/generated/${path}`;

export function resolveCharacterPortraitUrl(
  appearance: CharacterAppearance,
  baseUrl = import.meta.env.BASE_URL
) {
  const preset = resolveGuestPreset(appearance);
  return assetUrl(baseUrl, `guests/portraits/${preset.id}.png`);
}

export function resolveCharacterLayers(
  appearance: CharacterAppearance,
  baseUrl = import.meta.env.BASE_URL,
  displayMode: CharacterDisplayMode = "world"
): ResolvedCharacterLayer[] {
  const preset = resolveGuestPreset(appearance);
  const fallbackPreset = resolveGuestPreset(defaultCharacterAppearance);
  const usesSelectionPreview = displayMode === "preview" || displayMode === "thumbnail";
  const spritePath = (presetId: string, kind: "walk" | "idle") =>
    usesSelectionPreview
      ? `guests/preview/${presetId}__${kind}.png`
      : `guests/${presetId}__${kind}.png`;
  return [{
    slot: "base",
    walkUrl: assetUrl(baseUrl, spritePath(preset.id, "walk")),
    idleUrl: assetUrl(baseUrl, spritePath(preset.id, "idle")),
    fallbackWalkUrl: assetUrl(baseUrl, spritePath(fallbackPreset.id, "walk")),
    fallbackIdleUrl: assetUrl(baseUrl, spritePath(fallbackPreset.id, "idle")),
    sourceSize: usesSelectionPreview
      ? guestPresetFrame.selectionPreview.source
      : guestPresetFrame.source,
    displaySize: guestPresetFrame.display
  }];
}
