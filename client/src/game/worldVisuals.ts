import { worldZoneIds, type WorldZoneId } from "@wedding-game/shared";

export type WorldVisualEffect =
  | "window-light" | "leaf-shadow" | "station-glow" | "city-motion"
  | "garden-petals" | "lobby-glint" | "bridal-sparkle"
  | "aisle-light" | "mirror-glint" | "banquet-light";

type WorldVisualDefinition = {
  fallbackColor: string;
  effects: WorldVisualEffect[];
};

const definitions: Record<WorldZoneId, WorldVisualDefinition> = {
  home: { fallbackColor: "#d8c6b4", effects: ["window-light"] },
  neighborhood: { fallbackColor: "#9eb79e", effects: ["leaf-shadow"] },
  "subway-station": { fallbackColor: "#c8d2cf", effects: ["station-glow"] },
  "subway-train": { fallbackColor: "#d8ddd7", effects: ["city-motion"] },
  "venue-exterior": { fallbackColor: "#adc49f", effects: ["garden-petals"] },
  lobby: { fallbackColor: "#dedbd2", effects: ["lobby-glint"] },
  "bridal-room": { fallbackColor: "#e7d8d8", effects: ["bridal-sparkle"] },
  "ceremony-hall": { fallbackColor: "#536e5e", effects: ["aisle-light"] },
  restroom: { fallbackColor: "#d6e5e1", effects: ["mirror-glint"] },
  banquet: { fallbackColor: "#d9cfb9", effects: ["banquet-light"] }
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
