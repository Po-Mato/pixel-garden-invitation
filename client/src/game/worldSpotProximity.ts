import type { Point, WorldSpot } from "./world";

export type WorldSpotProximity = "near" | "mid" | "far";

export function resolveWorldSpotProximity(
  player: Point,
  spot: Pick<WorldSpot, "x" | "y" | "width" | "height" | "actionRadius">
): WorldSpotProximity {
  const distance = Math.hypot(
    spot.x + spot.width / 2 - player.x,
    spot.y + spot.height / 2 - player.y
  );
  const nearBoundary = spot.actionRadius + 120;
  if (distance <= nearBoundary) return "near";
  if (distance <= nearBoundary + 240) return "mid";
  return "far";
}
