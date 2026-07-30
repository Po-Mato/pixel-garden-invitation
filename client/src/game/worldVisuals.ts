import { worldZoneIds, type WorldZoneId } from "@wedding-game/shared";

export type WorldVisualEffect =
  | "window-light" | "leaf-shadow" | "station-glow" | "city-motion"
  | "garden-petals" | "lobby-glint" | "bridal-sparkle"
  | "aisle-light" | "mirror-glint" | "banquet-light";

export type WorldSurfaceTexture =
  | "warm-wood"
  | "garden-stone"
  | "station-terrazzo"
  | "train-metal"
  | "garden-path"
  | "lobby-marble"
  | "bridal-carpet"
  | "ceremony-velvet"
  | "banquet-parquet"
  | "restroom-tile";

export type WorldAtmosphereKind = "mote" | "petal" | "glint" | "streak" | "shimmer";

type WorldVisualDefinition = {
  fallbackColor: string;
  effects: WorldVisualEffect[];
  texture: WorldSurfaceTexture;
  atmosphere: WorldAtmosphereKind[];
};

const definitions: Record<WorldZoneId, WorldVisualDefinition> = {
  home: {
    fallbackColor: "#d8c6b4",
    effects: ["window-light"],
    texture: "warm-wood",
    atmosphere: ["mote", "glint"]
  },
  neighborhood: {
    fallbackColor: "#9eb79e",
    effects: ["leaf-shadow"],
    texture: "garden-stone",
    atmosphere: ["petal", "mote"]
  },
  "subway-station": {
    fallbackColor: "#c8d2cf",
    effects: ["station-glow"],
    texture: "station-terrazzo",
    atmosphere: ["streak", "glint"]
  },
  "subway-train": {
    fallbackColor: "#d8ddd7",
    effects: ["city-motion"],
    texture: "train-metal",
    atmosphere: ["streak", "shimmer"]
  },
  "venue-exterior": {
    fallbackColor: "#adc49f",
    effects: ["garden-petals"],
    texture: "garden-path",
    atmosphere: ["petal", "glint"]
  },
  lobby: {
    fallbackColor: "#dedbd2",
    effects: ["lobby-glint"],
    texture: "lobby-marble",
    atmosphere: ["glint", "shimmer"]
  },
  "bridal-room": {
    fallbackColor: "#e7d8d8",
    effects: ["bridal-sparkle"],
    texture: "bridal-carpet",
    atmosphere: ["petal", "glint"]
  },
  "ceremony-hall": {
    fallbackColor: "#536e5e",
    effects: ["aisle-light"],
    texture: "ceremony-velvet",
    atmosphere: ["mote", "glint"]
  },
  restroom: {
    fallbackColor: "#d6e5e1",
    effects: ["mirror-glint"],
    texture: "restroom-tile",
    atmosphere: ["shimmer", "glint"]
  },
  banquet: {
    fallbackColor: "#d9cfb9",
    effects: ["banquet-light"],
    texture: "banquet-parquet",
    atmosphere: ["glint", "mote"]
  }
};

const withTrailingSlash = (baseUrl: string) => baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

export const worldVisualZoneIds = [...worldZoneIds];

export function resolveWorldMapAsset(zoneId: WorldZoneId, fileName: string, baseUrl = import.meta.env.BASE_URL) {
  return `${withTrailingSlash(baseUrl)}assets/maps/v2/${zoneId}/${fileName}`;
}

export function worldDepth(y: number): number {
  return 1000 + Math.max(0, Math.round(Number.isFinite(y) ? y : 0));
}

export function resolveWorldVisual(zoneId: WorldZoneId, baseUrl = import.meta.env.BASE_URL) {
  return {
    backgroundUrl: resolveWorldMapAsset(zoneId, "background.webp", baseUrl),
    ...definitions[zoneId]
  };
}
