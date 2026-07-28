import { describe, expect, it } from "vitest";
import { allCelebrationCollectibles } from "./celebrationCollectibles";
import {
  celebrationZoneProgress,
  collectionProximityBand,
  nearestUncollectedCelebrationItem
} from "./celebrationCollectionGuide";
import { gardenWorld } from "./world";

describe("celebrationCollectionGuide", () => {
  it("summarizes collection progress for every map", () => {
    const items = allCelebrationCollectibles();
    const firstZoneIds = items.filter(({ zoneId }) => zoneId === gardenWorld.zones[0]!.id).map(({ id }) => id);
    const progress = celebrationZoneProgress(gardenWorld.zones, items, firstZoneIds);

    expect(progress).toHaveLength(gardenWorld.zones.length);
    expect(progress[0]).toMatchObject({ collectedCount: 3, totalCount: 3, complete: true });
    expect(progress[1]).toMatchObject({ collectedCount: 0, totalCount: 3, complete: false });
  });

  it("finds the nearest remaining item in the current map", () => {
    const items = allCelebrationCollectibles();
    const zoneItems = items.filter(({ zoneId }) => zoneId === "home");
    const result = nearestUncollectedCelebrationItem(items, [zoneItems[0]!.id], "home", zoneItems[1]!.point);

    expect(result?.item.id).toBe(zoneItems[1]!.id);
    expect(result?.distance).toBe(0);
  });

  it("uses stable proximity bands for haptic guidance", () => {
    expect(collectionProximityBand(151)).toBeNull();
    expect(collectionProximityBand(150)).toBe("near");
    expect(collectionProximityBand(72)).toBe("close");
    expect(collectionProximityBand(32)).toBe("arrived");
  });
});
