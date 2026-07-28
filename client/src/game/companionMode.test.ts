import { defaultCharacterAppearance } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { companionCandidates, companionFollowPath, nearbyPhotoCompanions } from "./companionMode";

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
});
