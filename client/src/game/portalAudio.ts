import { portalEntryTileSize, type Point, type WorldPortal } from "./world";

export type PortalAudioMix = {
  intensity: number;
  pan: number;
};

export const portalAudioRangePx = portalEntryTileSize * 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function portalAudioMixAt(position: Point, portals: WorldPortal[]): PortalAudioMix | null {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestHorizontalOffset = 0;

  portals.forEach((portal) => {
    portal.entryTiles.forEach((tile) => {
      const horizontalOffset = tile.x - position.x;
      const verticalOffset = tile.y - position.y;
      const distance = Math.hypot(horizontalOffset, verticalOffset);
      if (distance >= nearestDistance) return;
      nearestDistance = distance;
      nearestHorizontalOffset = horizontalOffset;
    });
  });

  if (!Number.isFinite(nearestDistance) || nearestDistance >= portalAudioRangePx) return null;

  const proximity = 1 - nearestDistance / portalAudioRangePx;
  return {
    intensity: proximity * proximity,
    pan: clamp(nearestHorizontalOffset / (portalAudioRangePx * 0.65), -1, 1)
  };
}
