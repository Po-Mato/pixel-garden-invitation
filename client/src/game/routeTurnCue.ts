import type { Direction } from "@wedding-game/shared";
import { directionTowardPoint } from "./movement";
import type { Point } from "./world";

export type RouteTurnCue = {
  corner: Point;
  direction: Direction;
  message: string;
};

const routeDirectionLabels: Record<Direction, string> = {
  up: "위쪽",
  down: "아래쪽",
  left: "왼쪽",
  right: "오른쪽"
};

export function routeTurnCueOneTileAhead(current: Point, path: Point[]): RouteTurnCue | null {
  const corner = path[0];
  const afterCorner = path[1];
  if (!corner || !afterCorner) return null;

  const incomingDirection = directionTowardPoint(current, corner);
  const outgoingDirection = directionTowardPoint(corner, afterCorner);
  if (!incomingDirection || !outgoingDirection || incomingDirection === outgoingDirection) return null;

  return {
    corner,
    direction: outgoingDirection,
    message: `다음 타일에서 ${routeDirectionLabels[outgoingDirection]}으로 이동해요`
  };
}
