import type { WorldZoneId } from "@wedding-game/shared";
import type { CelebrationCollectible } from "./celebrationCollectibles";
import type { Point, WorldZone } from "./world";

export type CollectionProximityBand = "near" | "close" | "arrived";

export type CelebrationZoneProgress = {
  zoneId: WorldZoneId;
  label: string;
  collectedCount: number;
  totalCount: number;
  complete: boolean;
};

export function celebrationZoneProgress(
  zones: readonly WorldZone[],
  items: readonly CelebrationCollectible[],
  collectedIds: readonly string[]
): CelebrationZoneProgress[] {
  const collected = new Set(collectedIds);
  return zones.map((zone) => {
    const zoneItems = items.filter(({ zoneId }) => zoneId === zone.id);
    const collectedCount = zoneItems.filter(({ id }) => collected.has(id)).length;
    return {
      zoneId: zone.id,
      label: zone.label,
      collectedCount,
      totalCount: zoneItems.length,
      complete: zoneItems.length > 0 && collectedCount === zoneItems.length
    };
  });
}

export function nearestUncollectedCelebrationItem(
  items: readonly CelebrationCollectible[],
  collectedIds: readonly string[],
  zoneId: WorldZoneId,
  position: Point
): { item: CelebrationCollectible; distance: number } | null {
  const collected = new Set(collectedIds);
  return items
    .filter((item) => item.zoneId === zoneId && !collected.has(item.id))
    .map((item) => ({ item, distance: Math.hypot(item.point.x - position.x, item.point.y - position.y) }))
    .sort((left, right) => left.distance - right.distance)[0] ?? null;
}

export function collectionProximityBand(distance: number): CollectionProximityBand | null {
  if (!Number.isFinite(distance) || distance < 0) return null;
  if (distance <= 32) return "arrived";
  if (distance <= 72) return "close";
  if (distance <= 150) return "near";
  return null;
}
