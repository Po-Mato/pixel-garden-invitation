import { describe, expect, it } from "vitest";
import { loadInvitationViewSync, saveGameViewLocation, saveQuickViewSection } from "./invitationViewSync";

function memoryStorage() {
  let value: string | null = null;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
}

describe("invitationViewSync", () => {
  it("maps the current game zone to a quick invitation section", () => {
    const storage = memoryStorage();
    saveGameViewLocation("bridal-room", null, storage);
    expect(loadInvitationViewSync(storage)).toMatchObject({ source: "game", sectionId: "couple", checkpointId: "bride" });
  });

  it("maps a viewed quick section back to a game destination", () => {
    const storage = memoryStorage();
    saveQuickViewSection("schedule", storage);
    expect(loadInvitationViewSync(storage)).toMatchObject({ source: "quick", checkpointId: "ceremony" });
  });
});
