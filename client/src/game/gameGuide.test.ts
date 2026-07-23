import { describe, expect, it } from "vitest";
import { createEmptyJourneyProgress } from "./journeyProgress";
import {
  completeGameGuide,
  createGameGuideState,
  gameGuideStorageKey,
  loadGameGuideState,
  shouldAutoOpenGameGuide
} from "./gameGuide";
import { memoryStorage } from "../test/memoryStorage";

describe("game first visit guide", () => {
  it("opens only for a new device with no journey progress", () => {
    const guide = createGameGuideState();
    expect(shouldAutoOpenGameGuide(guide, createEmptyJourneyProgress())).toBe(true);
    expect(shouldAutoOpenGameGuide(guide, {
      version: 1,
      completedIds: ["directions"],
      updatedAt: "2026-07-24T00:00:00.000Z"
    })).toBe(false);
    expect(shouldAutoOpenGameGuide({ ...guide, completed: true }, createEmptyJourneyProgress())).toBe(false);
  });

  it("persists completion and tolerates malformed values", () => {
    const storage = memoryStorage();
    expect(completeGameGuide(storage, "2026-07-24T01:00:00.000Z")).toBe(true);
    expect(loadGameGuideState(storage)).toEqual({
      version: 1,
      completed: true,
      completedAt: "2026-07-24T01:00:00.000Z"
    });

    storage.setItem(gameGuideStorageKey, "not-json");
    expect(loadGameGuideState(storage)).toEqual(createGameGuideState());
  });
});
