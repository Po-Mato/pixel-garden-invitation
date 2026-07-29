import { describe, expect, it, vi } from "vitest";
import {
  defaultDestinationVoicePreferences,
  loadDestinationVoicePreferences,
  normalizeDestinationVoicePreferences,
  saveDestinationVoicePreferences
} from "./destinationVoicePreferences";

describe("destinationVoicePreferences", () => {
  it("normalizes and persists custom Korean call phrases", () => {
    const storage = {
      value: "",
      getItem: vi.fn(() => storage.value),
      setItem: vi.fn((_key: string, value: string) => { storage.value = value; })
    };
    const preferences = normalizeDestinationVoicePreferences({
      movePhrase: " 출발해 ",
      nextPhrase: "다음 장소",
      cancelPhrase: "",
      repeatPhrase: "다시 알려줘"
    });
    expect(preferences).toEqual({
      movePhrase: "출발해",
      nextPhrase: "다음 장소",
      cancelPhrase: defaultDestinationVoicePreferences.cancelPhrase,
      repeatPhrase: "다시 알려줘"
    });
    expect(saveDestinationVoicePreferences(preferences, storage)).toBe(true);
    expect(loadDestinationVoicePreferences(storage)).toEqual(preferences);
  });
});
