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
      volume: "balanced",
      footstepVolume: "balanced",
      portalAudioEnabled: true,
      portalAudioVolume: "balanced"
    });
  });

  it("stores and restores a valid preference set", () => {
    const storage = memoryStorage();
    const preferences = {
      soundEnabled: true,
      effectsEnabled: false,
      musicEnabled: false,
      hapticsEnabled: false,
      volume: "quiet" as const,
      footstepVolume: "bright" as const,
      portalAudioEnabled: false,
      portalAudioVolume: "quiet" as const
    };

    expect(saveFeedbackPreferences(preferences, storage)).toBe(true);
    expect(loadFeedbackPreferences(storage)).toEqual(preferences);
  });

  it("keeps existing sound choices while adding new default sound levels", () => {
    const storage = memoryStorage();
    storage.setItem(feedbackPreferencesStorageKey, JSON.stringify({
      soundEnabled: true,
      effectsEnabled: false,
      musicEnabled: false,
      hapticsEnabled: true,
      volume: "quiet"
    }));

    expect(loadFeedbackPreferences(storage)).toEqual({
      soundEnabled: true,
      effectsEnabled: false,
      musicEnabled: false,
      hapticsEnabled: true,
      volume: "quiet",
      footstepVolume: "balanced",
      portalAudioEnabled: true,
      portalAudioVolume: "balanced"
    });
  });

  it("keeps the saved footstep level while adding portal audio defaults", () => {
    const storage = memoryStorage();
    storage.setItem(feedbackPreferencesStorageKey, JSON.stringify({
      soundEnabled: true,
      effectsEnabled: true,
      musicEnabled: true,
      hapticsEnabled: true,
      volume: "bright",
      footstepVolume: "quiet"
    }));

    expect(loadFeedbackPreferences(storage)).toMatchObject({
      footstepVolume: "quiet",
      portalAudioEnabled: true,
      portalAudioVolume: "balanced"
    });
  });

  it("falls back safely when stored data is incomplete", () => {
    const storage = memoryStorage();
    storage.setItem(feedbackPreferencesStorageKey, JSON.stringify({ soundEnabled: true }));

    expect(loadFeedbackPreferences(storage)).toEqual(defaultFeedbackPreferences);
  });
});
