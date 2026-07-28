import type { Point, WorldPortal } from "./world";
import type { PortalCongestion } from "./portalCongestion";

export type CrowdDensityCell = {
  point: Point;
  count: number;
  level: "light" | "medium" | "high";
};

export type PortalWaitEstimate = {
  seconds: number;
  label: string;
};

export function crowdDensityCells(points: readonly Point[], tileSize = 30): CrowdDensityCell[] {
  const buckets = new Map<string, { x: number; y: number; count: number }>();
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const x = Math.floor(point.x / tileSize) * tileSize + tileSize / 2;
    const y = Math.floor(point.y / tileSize) * tileSize + tileSize / 2;
    const key = `${x}:${y}`;
    const current = buckets.get(key);
    buckets.set(key, { x, y, count: (current?.count ?? 0) + 1 });
  }
  return [...buckets.values()].map(({ x, y, count }) => ({
    point: { x, y },
    count,
    level: count >= 4 ? "high" : count >= 2 ? "medium" : "light"
  }));
}

export function portalWaitEstimate(
  portal: WorldPortal,
  congestion: PortalCongestion,
  guestPoints: readonly Point[]
): PortalWaitEstimate {
  const nearby = guestPoints.filter((point) => (
    Math.hypot(point.x - portal.approach.x, point.y - portal.approach.y) <= 75
  )).length;
  const seconds = congestion.level === "full"
    ? Math.min(20, 8 + nearby * 2)
    : congestion.level === "busy" ? Math.min(9, 3 + nearby) : nearby >= 3 ? 2 : 0;
  return { seconds, label: seconds === 0 ? "바로 이동" : `예상 ${seconds}초` };
}
