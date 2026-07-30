import { MapPinned } from "lucide-react";
import type { Point } from "../game/world";
import { worldDepth } from "../game/worldVisuals";

type WorldDestinationBeaconProps = {
  point: Point;
  label: string;
  remainingTiles: number;
  kind: "portal" | "destination";
};

export function WorldDestinationBeacon({
  point,
  label,
  remainingTiles,
  kind
}: WorldDestinationBeaconProps) {
  return (
    <div
      className="world-destination-beacon"
      data-kind={kind}
      data-testid="world-destination-beacon"
      style={{ left: point.x, top: point.y, zIndex: worldDepth(point.y) - 180 }}
      aria-hidden="true"
    >
      <span className="world-destination-beacon__marker"><MapPinned /></span>
      <span className="world-destination-beacon__label">
        <strong>{label}</strong>
        <small>{remainingTiles > 0 ? `${remainingTiles}칸 남음` : "도착"}</small>
      </span>
    </div>
  );
}
