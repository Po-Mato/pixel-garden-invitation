import { describe, expect, it } from "vitest";
import { gardenWorld } from "./world";
import { allCelebrationCollectibles } from "./celebrationCollectibles";
import {
  celebrationKindRewardProgress,
  celebrationCosmeticRecommendation,
  loadCelebrationCosmetic,
  loadCelebrationCosmeticTone,
  celebrationRewardProgress,
  celebrationSetRewardProgress,
  newlyUnlockedCelebrationMilestones,
  saveCelebrationCosmetic,
  saveCelebrationCosmeticTone
} from "./celebrationReward";

describe("celebrationReward", () => {
  it("unlocks only after every unique item is collected", () => {
    expect(celebrationRewardProgress(["one", "one"], 2)).toMatchObject({
      collectedCount: 1,
      remainingCount: 1,
      unlocked: false
    });
    expect(celebrationRewardProgress(["one", "two"], 2)).toMatchObject({
      collectedCount: 2,
      remainingCount: 0,
      unlocked: true
    });
  });

  it("unlocks a distinct reward for each collectible kind", () => {
    const items = allCelebrationCollectibles();
    const petals = items.filter(({ kind }) => kind === "petal").map(({ id }) => id);
    expect(celebrationKindRewardProgress(petals, items)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "petal", unlocked: true, label: "꽃잎 발자국" }),
      expect.objectContaining({ kind: "ribbon", unlocked: false }),
      expect.objectContaining({ kind: "star", unlocked: false })
    ]));
  });

  it("reports newly completed kind and zone milestones once", () => {
    const items = allCelebrationCollectibles();
    const homeItems = items.filter(({ zoneId }) => zoneId === "home");
    const next = homeItems.map(({ id }) => id);
    const milestones = newlyUnlockedCelebrationMilestones([], next, items, gardenWorld.zones);
    expect(milestones).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "zone:home", type: "zone" })
    ]));
    expect(newlyUnlockedCelebrationMilestones(next, next, items, gardenWorld.zones)).toEqual([]);
  });

  it("persists the selected unlocked cosmetic", () => {
    const storage = {
      value: null as string | null,
      getItem: () => storage.value,
      setItem: (_key: string, value: string) => { storage.value = value; }
    };
    expect(loadCelebrationCosmetic(storage)).toBe("none");
    expect(saveCelebrationCosmetic("starlight-aura", storage)).toBe(true);
    expect(loadCelebrationCosmetic(storage)).toBe("starlight-aura");
  });

  it("unlocks the combined garden set only after every kind reward", () => {
    const items = allCelebrationCollectibles();
    expect(celebrationSetRewardProgress(items.map(({ id }) => id), items)).toMatchObject({
      unlocked: true,
      completedCount: 3,
      cosmeticId: "garden-blessing-set"
    });
    expect(celebrationSetRewardProgress(items.filter(({ kind }) => kind === "petal").map(({ id }) => id), items))
      .toMatchObject({ unlocked: false, completedCount: 1 });
  });

  it("recommends an unlocked effect and color that complements the selected outfit", () => {
    const items = allCelebrationCollectibles();
    const stars = items.filter(({ kind }) => kind === "star").map(({ id }) => id);
    expect(celebrationCosmeticRecommendation({ presetId: "masculine-navy-suit" }, stars, items))
      .toMatchObject({ cosmeticId: "starlight-aura", tone: "gold" });
    const storage = {
      value: null as string | null,
      getItem: () => storage.value,
      setItem: (_key: string, value: string) => { storage.value = value; }
    };
    expect(saveCelebrationCosmeticTone("sage", storage)).toBe(true);
    expect(loadCelebrationCosmeticTone(storage)).toBe("sage");
  });
});
