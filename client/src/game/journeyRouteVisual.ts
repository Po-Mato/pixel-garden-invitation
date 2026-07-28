import type { Direction } from "@wedding-game/shared";
import { resolveFootstepSurface, type FootstepSurface } from "./footstepSurface";
import type { Point, WorldZone } from "./world";

export type JourneyRouteSegment = {
  points: Point[];
  surface: FootstepSurface;
};

export type JourneyRouteTurn = {
  direction: Direction;
  point: Point;
  rotation: number;
  surface: FootstepSurface;
  tileIndex: number;
};

export type JourneyRouteTurnOptions = {
  maxMarkers?: number;
  minimumTileGap?: number;
};

const directionRotation: Record<Direction, number> = {
  up: -90,
  right: 0,
  down: 90,
  left: 180
};

function distinctRoutePoints(points: Point[]): Point[] {
  return points.filter((point, index) => (
    index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y
  ));
}

function routeDirection(from: Point, to: Point): Direction | null {
  const xDistance = to.x - from.x;
  const yDistance = to.y - from.y;

  if (xDistance === 0 && yDistance === 0) return null;
  if (Math.abs(xDistance) >= Math.abs(yDistance)) return xDistance > 0 ? "right" : "left";
  return yDistance > 0 ? "down" : "up";
}

function segmentSurface(zone: WorldZone, from: Point, to: Point): FootstepSurface {
  return resolveFootstepSurface(zone, {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2
  });
}

export function segmentJourneyRouteBySurface(zone: WorldZone, points: Point[]): JourneyRouteSegment[] {
  const routePoints = distinctRoutePoints(points);
  if (routePoints.length < 2) return [];

  const segments: JourneyRouteSegment[] = [];
  let current: JourneyRouteSegment = {
    surface: segmentSurface(zone, routePoints[0], routePoints[1]),
    points: [routePoints[0], routePoints[1]]
  };

  for (let index = 1; index < routePoints.length - 1; index += 1) {
    const from = routePoints[index];
    const to = routePoints[index + 1];
    const surface = segmentSurface(zone, from, to);

    if (current.surface === surface) {
      current.points.push(to);
      continue;
    }

    segments.push(current);
    current = { surface, points: [from, to] };
  }

  segments.push(current);
  return segments;
}

export function journeyRouteTurns(
  zone: WorldZone,
  points: Point[],
  options: JourneyRouteTurnOptions = {}
): JourneyRouteTurn[] {
  const routePoints = distinctRoutePoints(points);
  const turns: JourneyRouteTurn[] = [];
  const minimumTileGap = Math.max(1, Math.floor(options.minimumTileGap ?? 1));
  const maxMarkers = Math.max(0, Math.floor(options.maxMarkers ?? Number.POSITIVE_INFINITY));
  let lastAcceptedTileIndex = Number.NEGATIVE_INFINITY;
  if (maxMarkers === 0) return turns;

  for (let index = 1; index < routePoints.length - 1; index += 1) {
    const incoming = routeDirection(routePoints[index - 1], routePoints[index]);
    const outgoing = routeDirection(routePoints[index], routePoints[index + 1]);
    if (!incoming || !outgoing || incoming === outgoing) continue;
    if (index - lastAcceptedTileIndex < minimumTileGap) continue;

    turns.push({
      direction: outgoing,
      point: routePoints[index],
      rotation: directionRotation[outgoing],
      surface: resolveFootstepSurface(zone, routePoints[index]),
      tileIndex: index
    });
    lastAcceptedTileIndex = index;
    if (turns.length >= maxMarkers) break;
  }

  return turns;
}
