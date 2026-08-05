import type { WorldZoneId } from "@wedding-game/shared";
import { isBlocked } from "./geometry";
import { gridTileSize, snapToGrid } from "./movement";
import { gardenWorld, type Point, type WorldZone } from "./world";

export const celebrationCollectionStorageKey = "wedding-game:celebration-collection:v1";

export type CelebrationCollectibleKind = "petal" | "ribbon" | "star";

export type CelebrationCollectible = {
  id: string;
  zoneId: WorldZoneId;
  point: Point;
  kind: CelebrationCollectibleKind;
  label: string;
};

export const celebrationCollectibleRevealRadius = gridTileSize * 4;

export function visibleCelebrationCollectibles(
  items: readonly CelebrationCollectible[],
  collectedIds: readonly string[],
  player: Point,
  guidedCollectibleId: string | null = null,
  revealRadius = celebrationCollectibleRevealRadius
): CelebrationCollectible[] {
  const collected = new Set(collectedIds);
  return items.filter((item) => {
    if (collected.has(item.id)) return false;
    if (item.id === guidedCollectibleId) return true;
    return Math.hypot(item.point.x - player.x, item.point.y - player.y) <= revealRadius;
  });
}

type CollectionStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): CollectionStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function celebrationCollectiblesForZone(zone: WorldZone): CelebrationCollectible[] {
  const kinds: CelebrationCollectibleKind[] = ["petal", "ribbon", "star"];
  const labels = ["축하 꽃잎", "웨딩 리본", "반짝 별빛"];
  const preferredPoints = kinds.flatMap((_, index) => {
    const path = zone.paths[index % zone.paths.length];
    return path ? [snapToGrid({
      x: path.x + path.width * (index % 2 === 0 ? 0.28 : 0.72),
      y: path.y + path.height * (index === 1 ? 0.35 : 0.68)
    }, zone)] : [];
  });
  const fallbackPoints = zone.paths.flatMap((path) => [
    [0.2, 0.25], [0.5, 0.5], [0.8, 0.75], [0.25, 0.8], [0.75, 0.2]
  ].map(([xRatio, yRatio]) => snapToGrid({
    x: path.x + path.width * xRatio!,
    y: path.y + path.height * yRatio!
  }, zone)));
  const selected: Point[] = [];

  for (const point of [...preferredPoints, ...fallbackPoints]) {
    if (selected.length === kinds.length) break;
    if (
      Math.hypot(point.x - zone.spawn.x, point.y - zone.spawn.y) <= celebrationCollectibleRevealRadius
      || isBlocked(point, zone)
      || selected.some((candidate) => (
        candidate.x === point.x && candidate.y === point.y
      ))
    ) continue;
    selected.push(point);
  }

  return selected.map((point, index) => ({
    id: `${zone.id}-${kinds[index]!}`,
    zoneId: zone.id,
    point,
    kind: kinds[index]!,
    label: labels[index]!
  }));
}

export function allCelebrationCollectibles(): CelebrationCollectible[] {
  return gardenWorld.zones.flatMap(celebrationCollectiblesForZone);
}

export function loadCelebrationCollection(
  storage: CollectionStorage | null = browserStorage()
): string[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(celebrationCollectionStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const validIds = new Set(allCelebrationCollectibles().map(({ id }) => id));
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && validIds.has(id)))];
  } catch {
    return [];
  }
}

export function collectCelebrationItem(
  collectedIds: readonly string[],
  collectibleId: string,
  storage: CollectionStorage | null = browserStorage()
): string[] {
  const valid = allCelebrationCollectibles().some(({ id }) => id === collectibleId);
  if (!valid || collectedIds.includes(collectibleId)) return [...collectedIds];
  const next = [...collectedIds, collectibleId];
  try {
    storage?.setItem(celebrationCollectionStorageKey, JSON.stringify(next));
  } catch {
    return [...collectedIds];
  }
  return next;
}
