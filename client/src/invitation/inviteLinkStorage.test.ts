import { beforeEach, describe, expect, it } from "vitest";
import {
  clearStoredInvitationInvite,
  loadStoredInvitationInvite,
  saveStoredInvitationInvite
} from "./inviteLinkStorage";
import { installMemoryLocalStorage } from "../test/memoryStorage";

describe("invite link storage", () => {
  beforeEach(() => installMemoryLocalStorage());

  it("stores only a valid token and personalization payload", () => {
    const value = {
      token: "A".repeat(43),
      invite: { guestName: "김하객", side: "bride" as const, groupLabel: "친구" }
    };
    expect(saveStoredInvitationInvite("sample-garden", value)).toBe(true);
    expect(loadStoredInvitationInvite("sample-garden")).toEqual(value);
    clearStoredInvitationInvite("sample-garden");
    expect(loadStoredInvitationInvite("sample-garden")).toBeNull();
  });

  it("clears malformed stored values", () => {
    window.localStorage.setItem("wedding:invite-link:sample-garden", JSON.stringify({ token: "short" }));
    expect(loadStoredInvitationInvite("sample-garden")).toBeNull();
    expect(window.localStorage.getItem("wedding:invite-link:sample-garden")).toBeNull();
  });
});
