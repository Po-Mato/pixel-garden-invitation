import PF from "pathfinding";
import { isBlocked } from "./geometry";
import { gridTileSize } from "./movement";
import type { Point, WorldPortal, WorldZone } from "./world";

type GridPoint = { column: number; row: number };

export type PortalRoute = {
  entry: Point;
  path: Point[];
};

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

export function findTilePath(zone: WorldZone, start: Point, goal: Point): Point[] | null {
  const startGrid = toGridPoint(start, zone);
  const goalGrid = toGridPoint(goal, zone);
  if (!startGrid || !goalGrid) {
    return null;
  }

  if (isBlocked(start, zone) || isBlocked(goal, zone)) {
    return null;
  }

  const columns = Math.floor(zone.cameraSafeBounds.width / gridTileSize);
  const rows = Math.floor(zone.cameraSafeBounds.height / gridTileSize);
  const grid = new PF.Grid(columns, rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = toWorldPoint(column, row, zone);
      if (isBlocked(point, zone)) {
        grid.setWalkableAt(column, row, false);
      }
    }
  }

  const finder = new PF.AStarFinder({ allowDiagonal: false });
  const result = finder.findPath(
    startGrid.column,
    startGrid.row,
    goalGrid.column,
    goalGrid.row,
    grid
  );

  if (result.length === 0) {
    return null;
  }

  return result.slice(1).map(([column, row]) => toWorldPoint(column, row, zone));
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
