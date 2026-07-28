import { describe, expect, it } from "vitest";
import {
  celebrationCollectiblesForZone,
  collectCelebrationItem,
  loadCelebrationCollection
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
    });
  });

  it("persists each collected item once", () => {
    const storage = memoryStorage();
    const item = celebrationCollectiblesForZone(gardenWorld.zones[0]!)[0]!;
    const once = collectCelebrationItem([], item.id, storage);
    collectCelebrationItem(once, item.id, storage);
    expect(loadCelebrationCollection(storage)).toEqual([item.id]);
  });
});
