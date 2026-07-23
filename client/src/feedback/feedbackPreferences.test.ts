import { describe, expect, it } from "vitest";
import { memoryStorage } from "../test/memoryStorage";
import {
  defaultFeedbackPreferences,
  feedbackPreferencesStorageKey,
  loadFeedbackPreferences,
  saveFeedbackPreferences
} from "./feedbackPreferences";

describe("feedbackPreferences", () => {
  it("starts muted while retaining music and haptic choices", () => {
    expect(loadFeedbackPreferences(memoryStorage())).toEqual(defaultFeedbackPreferences);
    expect(defaultFeedbackPreferences).toMatchObject({
      soundEnabled: false,
      effectsEnabled: true,
      musicEnabled: true,
      hapticsEnabled: true,
      volume: "balanced"
    });
  });

  it("stores and restores a valid preference set", () => {
    const storage = memoryStorage();
    const preferences = {
      soundEnabled: true,
      effectsEnabled: false,
      musicEnabled: false,
      hapticsEnabled: false,
      volume: "quiet" as const
    };

    expect(saveFeedbackPreferences(preferences, storage)).toBe(true);
    expect(loadFeedbackPreferences(storage)).toEqual(preferences);
  });

  it("falls back safely when stored data is incomplete", () => {
    const storage = memoryStorage();
    storage.setItem(feedbackPreferencesStorageKey, JSON.stringify({ soundEnabled: true }));

    expect(loadFeedbackPreferences(storage)).toEqual(defaultFeedbackPreferences);
  });
});
