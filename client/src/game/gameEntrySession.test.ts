import { defaultCharacterAppearance } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { loadGameEntrySession, saveGameEntrySession } from "./gameEntrySession";

function memoryStorage() {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; }
  };
}

describe("gameEntrySession", () => {
  it("restores a recently entered guest profile", () => {
    const storage = memoryStorage();
    saveGameEntrySession({ nickname: " 검증하객 ", appearance: defaultCharacterAppearance }, storage, "2026-07-28T10:00:00.000Z");
    expect(loadGameEntrySession(storage, Date.parse("2026-07-29T10:00:00.000Z"))).toMatchObject({
      nickname: "검증하객",
      appearance: defaultCharacterAppearance
    });
  });

  it("does not auto-resume a stale profile", () => {
    const storage = memoryStorage();
    saveGameEntrySession({ nickname: "검증하객", appearance: defaultCharacterAppearance }, storage, "2026-05-01T10:00:00.000Z");
    expect(loadGameEntrySession(storage, Date.parse("2026-07-28T10:00:00.000Z"))).toBeNull();
  });
});
