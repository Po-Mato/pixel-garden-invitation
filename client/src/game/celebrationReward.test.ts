import { describe, expect, it } from "vitest";
import { gardenWorld } from "./world";
import { allCelebrationCollectibles } from "./celebrationCollectibles";
import {
  celebrationKindRewardProgress,
  celebrationRewardProgress,
  newlyUnlockedCelebrationMilestones
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
});
