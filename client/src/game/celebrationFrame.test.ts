import { describe, expect, it, vi } from "vitest";
import {
  celebrationFrameStorageKey,
  defaultCelebrationFrame,
  loadCelebrationFrameSelection,
  saveCelebrationFrameSelection
} from "./celebrationFrame";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

describe("celebrationFrame", () => {
  it("persists an unlocked palette and decoration", () => {
    const storage = memoryStorage();
    saveCelebrationFrameSelection({ palette: "rose", decoration: "ribbons" }, false, storage);
    expect(loadCelebrationFrameSelection(false, storage)).toEqual({ palette: "rose", decoration: "ribbons" });
  });

  it("keeps the wedding-day palette exclusive to the event date", () => {
    const storage = memoryStorage({
      [celebrationFrameStorageKey]: JSON.stringify({ palette: "wedding-day", decoration: "stars" })
    });
    expect(loadCelebrationFrameSelection(false, storage)).toEqual(defaultCelebrationFrame);
    expect(loadCelebrationFrameSelection(true, storage)).toEqual({ palette: "wedding-day", decoration: "stars" });
  });

  it("keeps a valid session selection when browser storage is unavailable", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => { throw new Error("storage blocked"); })
    };

    expect(saveCelebrationFrameSelection(
      { palette: "rose", decoration: "ribbons" },
      false,
      storage
    )).toEqual({ palette: "rose", decoration: "ribbons" });
  });
});
