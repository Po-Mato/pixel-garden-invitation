import { describe, expect, it } from "vitest";
import {
  celebrationCollectibleRevealRadius,
  celebrationCollectiblesForZone,
  collectCelebrationItem,
  loadCelebrationCollection,
  visibleCelebrationCollectibles
} from "./celebrationCollectibles";
import { gardenWorld } from "./world";

function memoryStorage() {
  let value: string | null = null;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
}

describe("celebrationCollectibles", () => {
  it("places three collectable wedding items on every map", () => {
    gardenWorld.zones.forEach((zone) => {
      const items = celebrationCollectiblesForZone(zone);
      expect(items, zone.id).toHaveLength(3);
      expect(items.map(({ kind }) => kind)).toEqual(["petal", "ribbon", "star"]);
      expect(items.every(({ point }) => (
        Math.hypot(point.x - zone.spawn.x, point.y - zone.spawn.y) > celebrationCollectibleRevealRadius
      )), zone.id).toBe(true);
    });
  });

  it("persists each collected item once", () => {
    const storage = memoryStorage();
    const item = celebrationCollectiblesForZone(gardenWorld.zones[0]!)[0]!;
    const once = collectCelebrationItem([], item.id, storage);
    collectCelebrationItem(once, item.id, storage);
    expect(loadCelebrationCollection(storage)).toEqual([item.id]);
  });

  it("reveals only nearby or guided uncollected items", () => {
    const items = celebrationCollectiblesForZone(gardenWorld.zones[0]!);
    const nearby = visibleCelebrationCollectibles(items, [], items[0]!.point, null, 1);
    expect(nearby.map(({ id }) => id)).toEqual([items[0]!.id]);

    const guided = visibleCelebrationCollectibles(items, [items[0]!.id], items[0]!.point, items[2]!.id, 1);
    expect(guided.map(({ id }) => id)).toEqual([items[2]!.id]);
  });
});
