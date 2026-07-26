import type { WorldZoneId } from "@wedding-game/shared";
import type { Point, WorldPathKind, WorldZone } from "./world";

export type FootstepSurface =
  | "wood"
  | "asphalt"
  | "concrete"
  | "metal"
  | "gravel"
  | "marble"
  | "carpet"
  | "tile";

const zoneSurface: Record<WorldZoneId, FootstepSurface> = {
  home: "wood",
  neighborhood: "asphalt",
  "subway-station": "concrete",
  "subway-train": "metal",
  "venue-exterior": "gravel",
  lobby: "marble",
  "bridal-room": "carpet",
  "ceremony-hall": "carpet",
  banquet: "carpet",
  restroom: "tile"
};

const pathSurfaceOverrides: Partial<Record<WorldZoneId, Partial<Record<WorldPathKind, FootstepSurface>>>> = {
  neighborhood: {
    street: "asphalt",
    crosswalk: "concrete"
  },
  "subway-station": {
    floor: "concrete",
    corridor: "concrete",
    platform: "concrete"
  },
  "subway-train": { carriage: "metal" },
  "venue-exterior": { garden: "gravel" },
  lobby: { lobby: "marble", corridor: "marble" },
  "bridal-room": { floor: "carpet" },
  "ceremony-hall": { aisle: "carpet", corridor: "carpet" },
  banquet: { banquet: "carpet", corridor: "carpet" },
  restroom: { floor: "tile" }
};

function containsPoint(path: { x: number; y: number; width: number; height: number }, point: Point) {
  return point.x >= path.x
    && point.x <= path.x + path.width
    && point.y >= path.y
    && point.y <= path.y + path.height;
}

export function resolveFootstepSurface(zone: WorldZone, point: Point): FootstepSurface {
  const matchingPath = zone.paths
    .filter((path) => containsPoint(path, point))
    .sort((first, second) => first.width * first.height - second.width * second.height)[0];

  if (!matchingPath) return zoneSurface[zone.id];
  return pathSurfaceOverrides[zone.id]?.[matchingPath.kind] ?? zoneSurface[zone.id];
}
