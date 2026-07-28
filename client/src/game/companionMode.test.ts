import { defaultCharacterAppearance } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import {
  clearCompanionSession,
  companionCandidates,
  companionFollowPath,
  createCompanionInviteUrl,
  loadCompanionSession,
  loadRealtimeIdentity,
  nearbyPhotoCompanions,
  parseCompanionInviteUrl,
  saveCompanionSession
} from "./companionMode";

const guests = [
  { guestId: "far", nickname: "먼하객", x: 240, y: 0, zoneId: "home" as const, appearance: defaultCharacterAppearance },
  { guestId: "near", nickname: "가까운하객", x: 30, y: 0, zoneId: "home" as const, appearance: defaultCharacterAppearance },
  { guestId: "other", nickname: "다른맵", x: 0, y: 0, zoneId: "lobby" as const, appearance: defaultCharacterAppearance }
];

describe("companionMode", () => {
  it("offers nearest guests from the same map", () => {
    expect(companionCandidates(guests, "home", { x: 0, y: 0 }).map(({ guestId }) => guestId))
      .toEqual(["near", "far"]);
  });

  it("keeps a two-tile following distance", () => {
    expect(companionFollowPath([1, 2, 3, 4, 5])).toEqual([1, 2, 3]);
    expect(companionFollowPath([1, 2])).toEqual([]);
  });

  it("selects only nearby guests for a group photo", () => {
    expect(nearbyPhotoCompanions(guests, "home", { x: 0, y: 0 }).map(({ guestId }) => guestId))
      .toEqual(["near"]);
  });

  it("keeps a stable realtime identity and restores a recent companion session", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    };
    expect(loadRealtimeIdentity(storage, () => "stable_guest_123456")).toBe("stable_guest_123456");
    expect(loadRealtimeIdentity(storage, () => "different_guest_123")).toBe("stable_guest_123456");
    saveCompanionSession({
      companionGuestId: "guest_friend_123456",
      companionNickname: "친구",
      role: "leader"
    }, storage, "2026-07-29T00:00:00.000Z");
    expect(loadCompanionSession(storage, Date.parse("2026-07-29T01:00:00.000Z")))
      .toMatchObject({ companionGuestId: "guest_friend_123456", role: "leader" });
    clearCompanionSession(storage);
    expect(loadCompanionSession(storage)).toBeNull();
  });

  it("creates and parses a same-zone companion invitation link", () => {
    const url = createCompanionInviteUrl(
      "https://example.com/invite/?view=invitation#gallery",
      "stable_guest_123456",
      "lobby"
    );
    expect(url).not.toContain("view=");
    expect(parseCompanionInviteUrl(url)).toEqual({
      targetGuestId: "guest_stable_guest_123456",
      zoneId: "lobby"
    });
    expect(parseCompanionInviteUrl("https://example.com/?together=bad&togetherZone=lobby")).toBeNull();
  });
});
