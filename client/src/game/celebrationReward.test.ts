import { describe, expect, it } from "vitest";
import { celebrationRewardProgress } from "./celebrationReward";

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
});
