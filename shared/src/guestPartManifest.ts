import rawManifest from "../../character-assets/guest-part-manifest.json";
import type { AccessorySlot, CharacterFamily, CharacterLayerSlot } from "./characterCatalog";

export type GuestSpriteSize = {
  width: number;
  height: number;
};

export type GuestWalkDirection = "down" | "left" | "right" | "up";
export type GuestPaletteKind = "skin" | "hair" | "outfit" | "fixed";

type GuestGeneratedTemplate = Record<string, string>;
type GuestSourcePath = Record<string, string>;

export type GuestBasePart = {
  id: CharacterFamily;
  family: CharacterFamily;
  layer: "base";
  palette: "skin";
  source: {
    walk: string;
    idle: string;
  };
  generated: {
    walk: string;
    idle: string;
  };
};

export type GuestHairPart = {
  id: string;
  family: CharacterFamily;
  layers: {
    back: "back-hair";
    front: "front-hair";
  };
  palette: "hair";
  source: {
    backWalk: string;
    frontWalk: string;
  };
  generated: {
    backWalk: string;
    frontWalk: string;
  };
};

export type GuestOutfitPart = {
  id: string;
  family: CharacterFamily;
  layer: "outfit";
  palette: "outfit";
  source: {
    walk: string;
  };
  generated: {
    walk: string;
  };
};

export type GuestAccessoryPart = {
  id: string;
  slot: AccessorySlot;
  layer: CharacterLayerSlot;
  palette: "fixed";
  source: {
    walk: string;
  };
  generated: {
    walk: string;
  };
};

export type GuestPartManifest = {
  version: number;
  frame: {
    source: GuestSpriteSize;
    display: {
      world: GuestSpriteSize;
      preview: GuestSpriteSize;
    };
    walk: {
      sheet: GuestSpriteSize;
      columns: number;
      rows: GuestWalkDirection[];
    };
    idle: {
      sheet: GuestSpriteSize;
      columns: number;
      frames: string[];
    };
  };
  layerOrder: CharacterLayerSlot[];
  parts: {
    base: GuestBasePart[];
    hair: GuestHairPart[];
    outfits: GuestOutfitPart[];
    accessories: GuestAccessoryPart[];
  };
};

export type GuestPart = GuestBasePart | GuestHairPart | GuestOutfitPart | GuestAccessoryPart;

export const guestPartManifest = rawManifest as GuestPartManifest;
export const guestLayerOrder = guestPartManifest.layerOrder;

export function resolveGeneratedGuestPath(template: string, values: Record<string, string>): string {
  return template.replaceAll(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = values[key];
    if (!value) {
      throw new Error(`Missing guest part template value: ${key}`);
    }
    return value;
  });
}
