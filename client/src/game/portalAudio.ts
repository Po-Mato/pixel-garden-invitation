import type { WorldZoneId } from "@wedding-game/shared";
import { portalEntryTileSize, type Point, type WorldPortal } from "./world";

export type PortalAudioMix = {
  intensity: number;
  pan: number;
  destination: WorldZoneId;
  direction: PortalGuideDirection;
};

export type PortalGuideDirection = "left" | "right" | "up" | "down" | "arrived";

export const portalAudioRangePx = portalEntryTileSize * 8;
export const portalArrivalRangePx = portalEntryTileSize * 0.6;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function portalAudioMixAt(position: Point, portals: WorldPortal[]): PortalAudioMix | null {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestHorizontalOffset = 0;
  let nearestVerticalOffset = 0;
  let nearestDestination: WorldZoneId | null = null;

  portals.forEach((portal) => {
    portal.entryTiles.forEach((tile) => {
      const horizontalOffset = tile.x - position.x;
      const verticalOffset = tile.y - position.y;
      const distance = Math.hypot(horizontalOffset, verticalOffset);
      if (distance >= nearestDistance) return;
      nearestDistance = distance;
      nearestHorizontalOffset = horizontalOffset;
      nearestVerticalOffset = verticalOffset;
      nearestDestination = portal.to;
    });
  });

  if (!nearestDestination || !Number.isFinite(nearestDistance) || nearestDistance >= portalAudioRangePx) return null;

  const proximity = 1 - nearestDistance / portalAudioRangePx;
  const direction: PortalGuideDirection = nearestDistance <= portalArrivalRangePx
    ? "arrived"
    : Math.abs(nearestHorizontalOffset) >= Math.abs(nearestVerticalOffset)
      ? nearestHorizontalOffset > 0 ? "right" : "left"
      : nearestVerticalOffset > 0 ? "down" : "up";
  return {
    intensity: proximity * proximity,
    pan: clamp(nearestHorizontalOffset / (portalAudioRangePx * 0.65), -1, 1),
    destination: nearestDestination,
    direction
  };
}
