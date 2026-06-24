import rawManifest from "../../character-assets/guest-part-manifest.json";

export type LegacyCharacterFamily = "masculine" | "feminine";
export type LegacyAccessorySlot = "face" | "jewelry" | "neckwear" | "carry";
export type LegacyCharacterLayerSlot =
  | "back-accessory"
  | "back-hair"
  | "base"
  | "outfit"
  | "front-hair"
  | "face"
  | "jewelry"
  | "neckwear"
  | "carry";

export type GuestSpriteSize = {
  width: number;
  height: number;
};

export type GuestWalkDirection = "down" | "left" | "right" | "up";
export type GuestBasePart = {
  id: LegacyCharacterFamily;
  family: LegacyCharacterFamily;
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
  family: LegacyCharacterFamily;
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
  family: LegacyCharacterFamily;
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
  slot: LegacyAccessorySlot;
  layer: LegacyCharacterLayerSlot;
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
  layerOrder: LegacyCharacterLayerSlot[];
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
