import PF from "pathfinding";
import { isBlocked } from "./geometry";
import { gridTileSize } from "./movement";
import type { Point, Rect, WorldPortal, WorldZone } from "./world";

type GridPoint = { column: number; row: number };

const axisAlignmentTieBreak = 0.001;

type WalkabilityGrid = ReturnType<typeof createWalkabilityGrid>;
type CachedRoute = readonly Point[] | null;

let walkabilityGridCache = new WeakMap<WorldZone, WalkabilityGrid>();
let routeResultCache = new WeakMap<WorldZone, Map<string, CachedRoute>>();
let cacheStats = { gridBuilds: 0, routeHits: 0, routeMisses: 0 };

export type PortalRoute = {
  entry: Point;
  path: Point[];
};

export type InteractionRoute = PortalRoute;

function minimumTurnHeuristic(dx: number, dy: number): number {
  return dx + dy + Math.min(dx, dy) * axisAlignmentTieBreak;
}

function toGridPoint(point: Point, zone: WorldZone): GridPoint | null {
  const safe = zone.cameraSafeBounds;
  const column = Math.round((point.x - safe.x - gridTileSize / 2) / gridTileSize);
  const row = Math.round((point.y - safe.y - gridTileSize / 2) / gridTileSize);
  const columns = Math.floor(safe.width / gridTileSize);
  const rows = Math.floor(safe.height / gridTileSize);

  if (column < 0 || row < 0 || column >= columns || row >= rows) {
    return null;
  }

  return { column, row };
}

function toWorldPoint(column: number, row: number, zone: WorldZone): Point {
  return {
    x: zone.cameraSafeBounds.x + gridTileSize / 2 + column * gridTileSize,
    y: zone.cameraSafeBounds.y + gridTileSize / 2 + row * gridTileSize
  };
}

function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function createWalkabilityGrid(zone: WorldZone) {
  const columns = Math.floor(zone.cameraSafeBounds.width / gridTileSize);
  const rows = Math.floor(zone.cameraSafeBounds.height / gridTileSize);
  const grid = new PF.Grid(columns, rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = toWorldPoint(column, row, zone);
      if (isBlocked(point, zone)) grid.setWalkableAt(column, row, false);
    }
  }

  cacheStats.gridBuilds += 1;
  return grid;
}

function walkabilityGridFor(zone: WorldZone): WalkabilityGrid {
  const cached = walkabilityGridCache.get(zone);
  if (cached) return cached;
  const grid = createWalkabilityGrid(zone);
  walkabilityGridCache.set(zone, grid);
  return grid;
}

function cloneRoute(route: CachedRoute): Point[] | null {
  return route ? route.map((point) => ({ ...point })) : null;
}

export function resetPathfindingCache(): void {
  walkabilityGridCache = new WeakMap();
  routeResultCache = new WeakMap();
  cacheStats = { gridBuilds: 0, routeHits: 0, routeMisses: 0 };
}

export function getPathfindingCacheStats() {
  return { ...cacheStats };
}

export function findTilePath(zone: WorldZone, start: Point, goal: Point): Point[] | null {
  const startGrid = toGridPoint(start, zone);
  const goalGrid = toGridPoint(goal, zone);
  if (!startGrid || !goalGrid) {
    return null;
  }

  if (isBlocked(start, zone) || isBlocked(goal, zone)) {
    return null;
  }

  const routeKey = `${startGrid.column},${startGrid.row}:${goalGrid.column},${goalGrid.row}`;
  const zoneRoutes = routeResultCache.get(zone) ?? new Map<string, CachedRoute>();
  if (zoneRoutes.has(routeKey)) {
    cacheStats.routeHits += 1;
    return cloneRoute(zoneRoutes.get(routeKey) ?? null);
  }
  cacheStats.routeMisses += 1;
  routeResultCache.set(zone, zoneRoutes);

  const finder = new PF.AStarFinder({
    allowDiagonal: false,
    heuristic: minimumTurnHeuristic
  });
  const result = finder.findPath(
    startGrid.column,
    startGrid.row,
    goalGrid.column,
    goalGrid.row,
    walkabilityGridFor(zone).clone()
  );

  if (result.length === 0) {
    zoneRoutes.set(routeKey, null);
    return null;
  }

  const route = result.slice(1).map(([column, row]) => toWorldPoint(column, row, zone));
  zoneRoutes.set(routeKey, route);
  return cloneRoute(route);
}

export function findNearestPortalRoute(
  zone: WorldZone,
  start: Point,
  portal: WorldPortal
): PortalRoute | null {
  const routes = portal.entryTiles
    .map((entry) => ({ entry, path: findTilePath(zone, start, entry) }))
    .filter((candidate): candidate is PortalRoute => candidate.path !== null);

  routes.sort((a, b) => {
    const lengthDifference = a.path.length - b.path.length;
    if (lengthDifference !== 0) return lengthDifference;

    const aIsCenter = a.entry.x === portal.approach.x && a.entry.y === portal.approach.y;
    const bIsCenter = b.entry.x === portal.approach.x && b.entry.y === portal.approach.y;
    return Number(bIsCenter) - Number(aIsCenter);
  });

  return routes[0] ?? null;
}

export function findNearestInteractionRoute(
  zone: WorldZone,
  start: Point,
  target: Rect,
  actionRadius: number
): InteractionRoute | null {
  const columns = Math.floor(zone.cameraSafeBounds.width / gridTileSize);
  const rows = Math.floor(zone.cameraSafeBounds.height / gridTileSize);
  const routeZone = {
    ...zone,
    blocked: [...zone.blocked, target]
  };
  const center = rectCenter(target);
  const routes: InteractionRoute[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const entry = toWorldPoint(column, row, zone);
      if (
        distanceToRect(entry, target) > actionRadius + gridTileSize / 2
        || isBlocked(entry, routeZone)
      ) continue;

      const path = findTilePath(routeZone, start, entry);
      if (path !== null) routes.push({ entry, path });
    }
  }

  routes.sort((a, b) => {
    const lengthDifference = a.path.length - b.path.length;
    if (lengthDifference !== 0) return lengthDifference;

    const aDistance = Math.hypot(a.entry.x - center.x, a.entry.y - center.y);
    const bDistance = Math.hypot(b.entry.x - center.x, b.entry.y - center.y);
    return aDistance - bDistance;
  });

  return routes[0] ?? null;
}
