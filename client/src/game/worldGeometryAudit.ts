import { isBlocked } from "./geometry";
import { gridTileSize } from "./movement";
import type { Point, Rect, WorldZone } from "./world";
import { worldPropInteractionsForZone } from "./worldPropInteractions";

export type WorldGeometryTileState = "reachable" | "blocked" | "unreachable";

export type WorldGeometryAuditTile = Point & {
  column: number;
  row: number;
  state: WorldGeometryTileState;
};

export type WorldGeometryAudit = {
  zoneId: WorldZone["id"];
  tiles: WorldGeometryAuditTile[];
  reachableCount: number;
  blockedCount: number;
  unreachableCount: number;
  issues: string[];
};

const tileKey = (column: number, row: number) => `${column}:${row}`;

function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

function tileCoordinates(zone: WorldZone, point: Point) {
  const column = Math.round((point.x - zone.cameraSafeBounds.x - gridTileSize / 2) / gridTileSize);
  const row = Math.round((point.y - zone.cameraSafeBounds.y - gridTileSize / 2) / gridTileSize);
  return { column, row };
}

export function auditWorldGeometry(zone: WorldZone): WorldGeometryAudit {
  const columns = Math.floor(zone.cameraSafeBounds.width / gridTileSize);
  const rows = Math.floor(zone.cameraSafeBounds.height / gridTileSize);
  const baseTiles = Array.from({ length: rows * columns }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const point = {
      x: zone.cameraSafeBounds.x + gridTileSize / 2 + column * gridTileSize,
      y: zone.cameraSafeBounds.y + gridTileSize / 2 + row * gridTileSize
    };
    return { ...point, column, row, blocked: isBlocked(point, zone) };
  });
  const tileByKey = new Map(baseTiles.map((tile) => [tileKey(tile.column, tile.row), tile]));
  const spawnGrid = tileCoordinates(zone, zone.spawn);
  const spawnTile = tileByKey.get(tileKey(spawnGrid.column, spawnGrid.row));
  const reachable = new Set<string>();
  const queue: Array<{ column: number; row: number }> = [];
  const issues: string[] = [];

  if (!spawnTile || spawnTile.blocked) {
    issues.push("시작 타일이 이동 가능 영역에 없습니다.");
  } else {
    const startKey = tileKey(spawnTile.column, spawnTile.row);
    reachable.add(startKey);
    queue.push(spawnTile);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const column = current.column + dx;
      const row = current.row + dy;
      const key = tileKey(column, row);
      const candidate = tileByKey.get(key);
      if (!candidate || candidate.blocked || reachable.has(key)) continue;
      reachable.add(key);
      queue.push(candidate);
    }
  }

  const tiles: WorldGeometryAuditTile[] = baseTiles.map((tile) => ({
    x: tile.x,
    y: tile.y,
    column: tile.column,
    row: tile.row,
    state: tile.blocked
      ? "blocked"
      : reachable.has(tileKey(tile.column, tile.row)) ? "reachable" : "unreachable"
  }));
  const unreachableTiles = tiles.filter((tile) => tile.state === "unreachable");
  if (unreachableTiles.length > 0) {
    issues.push(`시작점에서 닿을 수 없는 이동 타일이 ${unreachableTiles.length}개 있습니다.`);
  }

  for (const portal of zone.portals) {
    for (const entry of portal.entryTiles) {
      const grid = tileCoordinates(zone, entry);
      const tile = tileByKey.get(tileKey(grid.column, grid.row));
      if (!tile || tile.blocked || !reachable.has(tileKey(grid.column, grid.row))) {
        issues.push(`${portal.label} 진입 타일 ${entry.x},${entry.y}에 도달할 수 없습니다.`);
      }
    }
  }

  const interactionTargets = [
    ...zone.spots.map((target) => ({ label: target.label, rect: target, radius: target.actionRadius })),
    ...zone.photoSpots.map((target) => ({ label: target.label, rect: target, radius: target.actionRadius })),
    ...worldPropInteractionsForZone(zone).map(({ decoration, interaction }) => ({
      label: decoration.label,
      rect: decoration,
      radius: interaction.actionRadius
    })),
    ...zone.npcs.map((target) => ({
      label: target.label,
      rect: { x: target.x, y: target.y, width: 0, height: 0 },
      radius: 30
    }))
  ];
  for (const target of interactionTargets) {
    const hasReachableApproach = tiles.some((tile) => (
      tile.state === "reachable" && distanceToRect(tile, target.rect) <= target.radius
    ));
    if (!hasReachableApproach) issues.push(`${target.label} 상호작용 범위에 도달할 수 없습니다.`);
  }

  return {
    zoneId: zone.id,
    tiles,
    reachableCount: tiles.filter((tile) => tile.state === "reachable").length,
    blockedCount: tiles.filter((tile) => tile.state === "blocked").length,
    unreachableCount: unreachableTiles.length,
    issues
  };
}
