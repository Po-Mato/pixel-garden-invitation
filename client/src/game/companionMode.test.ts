import { defaultCharacterAppearance } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import {
  clearCompanionSession,
  appendCompanionTrailPoint,
  companionCandidates,
  companionArrivalEstimate,
  companionFollowPath,
  companionRendezvousPoint,
  companionRendezvousReplanPoint,
  companionInviteRemainingLabel,
  createCompanionInviteCode,
  createCompanionInviteUrl,
  inspectCompanionInviteUrl,
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

  it("keeps a compact companion trail and finds the midpoint for rendezvous", () => {
    expect(appendCompanionTrailPoint([{ x: 0, y: 0 }], { x: 4, y: 3 }, 12))
      .toEqual([{ x: 0, y: 0 }]);
    expect(appendCompanionTrailPoint([{ x: 0, y: 0 }], { x: 12, y: 0 }, 12))
      .toEqual([{ x: 0, y: 0 }, { x: 12, y: 0 }]);
    expect(appendCompanionTrailPoint([
      { x: 0, y: 0 },
      { x: 12, y: 0 }
    ], { x: 24, y: 0 }, 12, 2)).toEqual([{ x: 12, y: 0 }, { x: 24, y: 0 }]);
    expect(companionRendezvousPoint({ x: 30, y: 90 }, { x: 90, y: 30 }))
      .toEqual({ x: 60, y: 60 });
    expect(companionRendezvousReplanPoint(
      { x: 60, y: 60 },
      { x: 30, y: 90 },
      { x: 110, y: 30 }
    )).toBeNull();
    expect(companionRendezvousReplanPoint(
      { x: 60, y: 60 },
      { x: 300, y: 90 },
      { x: 420, y: 150 }
    )).toEqual({ x: 360, y: 120 });
  });

  it("selects only nearby guests for a group photo", () => {
    expect(nearbyPhotoCompanions(guests, "home", { x: 0, y: 0 }).map(({ guestId }) => guestId))
      .toEqual(["near"]);
  });

  it("reports same-zone distance and cross-zone portal arrival guidance", () => {
    expect(companionArrivalEstimate({ x: 0, y: 0 }, "home", guests[1]!, "우리 집", 24))
      .toEqual({ locationLabel: "우리 집 · 오른쪽 약 2칸", distanceTiles: 2, etaLabel: "약 5초" });
    expect(companionArrivalEstimate({ x: 0, y: 0 }, "home", guests[2]!, "예식장 로비", 24))
      .toEqual({ locationLabel: "예식장 로비", distanceTiles: null, etaLabel: "포털 이동 필요" });
    expect(companionArrivalEstimate({ x: 0, y: 0 }, "home", null, "", 24).etaLabel).toBe("재접속 대기");
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
    const expiresAt = Date.parse("2026-07-29T00:10:00.000Z");
    const url = createCompanionInviteUrl(
      "https://example.com/invite/?view=invitation#gallery",
      "stable_guest_123456",
      "lobby",
      expiresAt,
      "ABC234"
    );
    expect(url).not.toContain("view=");
    expect(parseCompanionInviteUrl(url, expiresAt - 1)).toEqual({
      targetGuestId: "guest_stable_guest_123456",
      zoneId: "lobby",
      expiresAt,
      inviteCode: "ABC234"
    });
    expect(parseCompanionInviteUrl("https://example.com/?together=bad&togetherZone=lobby")).toBeNull();
    expect(inspectCompanionInviteUrl(url, expiresAt)).toEqual({ status: "expired", expiresAt });
    expect(companionInviteRemainingLabel(expiresAt, expiresAt - 65_000)).toBe("01:05");
    expect(createCompanionInviteCode(() => 0)).toBe("AAAAAA");
  });
});
