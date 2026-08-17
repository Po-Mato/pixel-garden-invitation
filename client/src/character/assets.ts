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

const guestAssetRevisions: Partial<Record<string, string>> = {
  "feminine-champagne-navy-skirt": "optical-three-head-v2",
  "feminine-lavender-jacket-dress": "optical-three-head-v2",
  "feminine-teal-modern-hanbok": "optical-three-head-v2"
};

const assetUrl = (baseUrl: string, path: string, revision?: string) =>
  `${baseUrl}characters/generated/${path}${revision ? `?v=${revision}` : ""}`;

export function resolveCharacterPortraitUrl(
  appearance: CharacterAppearance,
  baseUrl = import.meta.env.BASE_URL
) {
  const preset = resolveGuestPreset(appearance);
  return assetUrl(
    baseUrl,
    `guests/portraits/${preset.id}.png`,
    guestAssetRevisions[preset.id]
  );
}

export function resolveCharacterLayers(
  appearance: CharacterAppearance,
  baseUrl = import.meta.env.BASE_URL,
  displayMode: CharacterDisplayMode = "world"
): ResolvedCharacterLayer[] {
  const preset = resolveGuestPreset(appearance);
  const fallbackPreset = resolveGuestPreset(defaultCharacterAppearance);
  const usesSelectionPreview = displayMode === "preview" || displayMode === "thumbnail";
  const selectedRevision = guestAssetRevisions[preset.id];
  const fallbackRevision = guestAssetRevisions[fallbackPreset.id];
  const spritePath = (presetId: string, kind: "walk" | "idle") =>
    usesSelectionPreview
      ? `guests/preview/${presetId}__${kind}.png`
      : `guests/${presetId}__${kind}.png`;
  return [{
    slot: "base",
    walkUrl: assetUrl(baseUrl, spritePath(preset.id, "walk"), selectedRevision),
    idleUrl: assetUrl(baseUrl, spritePath(preset.id, "idle"), selectedRevision),
    fallbackWalkUrl: assetUrl(
      baseUrl,
      spritePath(fallbackPreset.id, "walk"),
      fallbackRevision
    ),
    fallbackIdleUrl: assetUrl(
      baseUrl,
      spritePath(fallbackPreset.id, "idle"),
      fallbackRevision
    ),
    sourceSize: usesSelectionPreview
      ? guestPresetFrame.selectionPreview.source
      : guestPresetFrame.source,
    displaySize: guestPresetFrame.display
  }];
}
