import rawPresets from "../../character-assets/guest-character-presets.json";

export type CharacterFamily = "masculine" | "feminine";

export type GuestSpriteSize = {
  width: number;
  height: number;
};

export type GuestPresetFrame = {
  source: GuestSpriteSize;
  display: {
    world: GuestSpriteSize;
    preview: GuestSpriteSize;
  };
  walk: {
    sheet: GuestSpriteSize;
    columns: number;
    rows: Array<"down" | "left" | "right" | "up">;
  };
  idle: {
    sheet: GuestSpriteSize;
    columns: number;
    frames: string[];
  };
};

export type GuestDirection = GuestPresetFrame["walk"]["rows"][number];

export type GuestCharacterPreset = {
  id: string;
  family: CharacterFamily;
  label: string;
  description: string;
  reference: {
    image: string;
    crop: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
    directions: Record<GuestDirection, string>;
  };
  source: {
    walk: string;
    idle: string;
  };
  generated: {
    walk: string;
    idle: string;
  };
};

type GuestCharacterPresetCatalog = {
  version: number;
  frame: GuestPresetFrame;
  defaultPresetId: string;
  defaultByFamily: Record<CharacterFamily, string>;
  presets: GuestCharacterPreset[];
};

export const guestCharacterPresetCatalog = rawPresets as GuestCharacterPresetCatalog;
export const guestPresetFrame = guestCharacterPresetCatalog.frame;
export const guestCharacterPresets = guestCharacterPresetCatalog.presets;
export const defaultGuestPresetId = guestCharacterPresetCatalog.defaultPresetId;

const presetById = new Map(guestCharacterPresets.map((preset) => [preset.id, preset]));

export function isGuestPresetId(value: unknown): value is string {
  return typeof value === "string" && presetById.has(value);
}

export function getDefaultPresetId(family?: CharacterFamily): string {
  return family ? guestCharacterPresetCatalog.defaultByFamily[family] : defaultGuestPresetId;
}

export function resolveGuestPreset(appearance: { presetId: string }): GuestCharacterPreset {
  return presetById.get(appearance.presetId) ?? presetById.get(defaultGuestPresetId) ?? guestCharacterPresets[0];
}
