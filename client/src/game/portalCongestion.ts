import { gridTileSize } from "./movement";
import type { Point, WorldPortal } from "./world";

export type PortalCongestionLevel = "open" | "busy" | "full";

export type PortalEntryAvailability = {
  point: Point;
  occupied: boolean;
};

export type PortalCongestion = {
  level: PortalCongestionLevel;
  label: string;
  openCount: number;
  totalCount: number;
  entries: PortalEntryAvailability[];
};

export function portalCongestion(
  portal: WorldPortal,
  occupiedPoints: readonly Point[],
  clearance = gridTileSize * 0.72
): PortalCongestion {
  const entries = portal.entryTiles.map((point) => ({
    point,
    occupied: occupiedPoints.some((occupied) => (
      Math.hypot(point.x - occupied.x, point.y - occupied.y) < clearance
    ))
  }));
  const openCount = entries.filter((entry) => !entry.occupied).length;
  const level: PortalCongestionLevel = openCount === 0
    ? "full"
    : openCount === entries.length ? "open" : "busy";

  return {
    level,
    label: level === "open" ? "여유" : level === "busy" ? "우회 가능" : "잠시 대기",
    openCount,
    totalCount: entries.length,
    entries
  };
}
