import type { Direction } from "@wedding-game/shared";
import { directionTowardPoint } from "./movement";
import { findNearestInteractionRoute, findNearestPortalRoute } from "./pathfinding";
import type { JourneyCheckpoint } from "./journeyProgress";
import { nextWorldZoneToward } from "./worldAssetPreloader";
import { gardenWorld, getWorldZone, type GardenWorld, type Point, type WorldZone } from "./world";

export type JourneyGuidancePreview = {
  direction: Direction | null;
  tileCount: number;
  path: readonly Point[];
  destinationPoint: Point;
  portalId: string | null;
  available: boolean;
};

export type JourneyCheckpointRoute = {
  entry: Point;
  path: Point[];
  destinationPoint: Point;
};

const npcInteractionRadius = 30;

function npcRect(npc: { x: number; y: number }) {
  return { x: npc.x - 30, y: npc.y - 45, width: 60, height: 75 };
}

function previewFromPath(
  position: Point,
  destinationPoint: Point,
  path: Point[] | null,
  portalId: string | null
): JourneyGuidancePreview {
  return {
    direction: path?.[0] ? directionTowardPoint(position, path[0]) : null,
    tileCount: path?.length ?? 0,
    path: path ?? [],
    destinationPoint,
    portalId,
    available: path !== null
  };
}

export function resolveJourneyCheckpointRoute(
  zone: WorldZone,
  position: Point,
  checkpoint: JourneyCheckpoint
): JourneyCheckpointRoute | null {
  if (checkpoint.zoneId !== zone.id) return null;

  if (checkpoint.target.type === "spot") {
    const spotId = checkpoint.target.spotId;
    const target = zone.spots.find((spot) => spot.id === spotId);
    if (!target) return null;
    const route = findNearestInteractionRoute(zone, position, target, target.actionRadius);
    return route ? {
      entry: route.entry,
      path: route.path,
      destinationPoint: { x: target.x + target.width / 2, y: target.y + target.height / 2 }
    } : null;
  }

  if (checkpoint.target.type === "npc") {
    const npcId = checkpoint.target.npcId;
    const target = zone.npcs.find((npc) => npc.id === npcId);
    if (!target) return null;
    const route = findNearestInteractionRoute(zone, position, npcRect(target), npcInteractionRadius);
    return route ? { entry: route.entry, path: route.path, destinationPoint: target } : null;
  }

  return { entry: position, path: [], destinationPoint: position };
}

export function resolveJourneyGuidance(
  zone: WorldZone,
  position: Point,
  checkpoint: JourneyCheckpoint,
  world: GardenWorld = gardenWorld
): JourneyGuidancePreview | null {
  if (checkpoint.zoneId !== zone.id) {
    const nextZoneId = nextWorldZoneToward(zone.id, checkpoint.zoneId, world);
    const portal = nextZoneId ? zone.portals.find((candidate) => candidate.to === nextZoneId) : null;
    if (!portal) return null;
    const route = findNearestPortalRoute(zone, position, portal);
    return previewFromPath(position, portal.approach, route?.path ?? null, portal.id);
  }

  const route = resolveJourneyCheckpointRoute(zone, position, checkpoint);
  const destination = route?.destinationPoint ?? getWorldZone(world, checkpoint.zoneId).spawn;
  return previewFromPath(position, destination, route?.path ?? null, null);
}

export const journeyDirectionLabels: Record<Direction, string> = {
  up: "위쪽",
  down: "아래쪽",
  left: "왼쪽",
  right: "오른쪽"
};
