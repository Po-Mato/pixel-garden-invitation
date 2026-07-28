import { describe, expect, it } from "vitest";
import { defaultCharacterAppearance } from "./characterCatalog";
import { worldZoneIds } from "./protocol";
import { clampNumber, parseClientMessage, sanitizeText } from "./validation";

describe("sanitizeText", () => {
  it("trims text and limits length", () => {
    expect(sanitizeText("  garden guest  ", 20)).toBe("garden guest");
    expect(sanitizeText("abcdef", 3)).toBe("abc");
  });

  it("removes control characters", () => {
    expect(sanitizeText("hi\u0000there\u001f", 20)).toBe("hithere");
  });
});

describe("clampNumber", () => {
  it("clamps to map bounds", () => {
    expect(clampNumber(-5, 0, 100)).toBe(0);
    expect(clampNumber(105, 0, 100)).toBe(100);
    expect(clampNumber(50, 0, 100)).toBe(50);
  });
});

describe("parseClientMessage", () => {
  it("accepts a valid appearance join", () => {
    expect(parseClientMessage({
      type: "join",
      nickname: "민지",
      appearance: defaultCharacterAppearance,
      zoneId: "home"
    })).toEqual({
      type: "join",
      nickname: "민지",
      appearance: defaultCharacterAppearance,
      zoneId: "home"
    });
  });

  it("rejects an unknown join zone", () => {
    expect(parseClientMessage({
      type: "join",
      nickname: "민지",
      appearance: defaultCharacterAppearance,
      zoneId: "rooftop"
    })).toBeNull();
  });

  it("rejects the legacy avatar join shape", () => {
    expect(parseClientMessage({
      type: "join",
      nickname: "민지",
      avatar: "classic",
      color: "rose"
    })).toBeNull();
  });

  it("accepts a valid move message", () => {
    expect(parseClientMessage({
      type: "move",
      x: 48,
      y: 72,
      direction: "down",
      moving: true,
      seq: 7,
      zoneId: "banquet"
    })).toEqual({
      type: "move",
      x: 48,
      y: 72,
      direction: "down",
      moving: true,
      seq: 7,
      zoneId: "banquet"
    });
  });

  it("accepts only the four predefined guest reactions", () => {
    for (const reaction of ["wave", "heart", "applause", "celebrate"] as const) {
      expect(parseClientMessage({ type: "react", reaction })).toEqual({ type: "react", reaction });
    }

    expect(parseClientMessage({ type: "react", reaction: "custom-text" })).toBeNull();
    expect(parseClientMessage({ type: "react", reaction: 1 })).toBeNull();
  });

  it("validates targeted companion invitations and replies", () => {
    expect(parseClientMessage({ type: "companion_invite", targetGuestId: "guest_two" }))
      .toEqual({ type: "companion_invite", targetGuestId: "guest_two" });
    expect(parseClientMessage({ type: "companion_reply", requesterGuestId: "guest_one", accepted: true }))
      .toEqual({ type: "companion_reply", requesterGuestId: "guest_one", accepted: true });
    expect(parseClientMessage({ type: "companion_stop", targetGuestId: "guest_two" }))
      .toEqual({ type: "companion_stop", targetGuestId: "guest_two" });
    expect(parseClientMessage({ type: "companion_destination", targetGuestId: "guest_two", portalId: "home-to-neighborhood", destinationZoneId: "neighborhood" }))
      .toEqual({ type: "companion_destination", targetGuestId: "guest_two", portalId: "home-to-neighborhood", destinationZoneId: "neighborhood" });
    expect(parseClientMessage({ type: "companion_portal_ready", targetGuestId: "guest_two", portalId: "home-to-neighborhood", destinationZoneId: "neighborhood" }))
      .toEqual({ type: "companion_portal_ready", targetGuestId: "guest_two", portalId: "home-to-neighborhood", destinationZoneId: "neighborhood" });
    expect(parseClientMessage({ type: "companion_destination_request", targetGuestId: "guest_two" }))
      .toEqual({ type: "companion_destination_request", targetGuestId: "guest_two" });
    expect(parseClientMessage({ type: "companion_ping", targetGuestId: "guest_two", ping: "here" }))
      .toEqual({ type: "companion_ping", targetGuestId: "guest_two", ping: "here" });
    expect(parseClientMessage({ type: "companion_ping", targetGuestId: "guest_two", ping: "unknown" }))
      .toBeNull();
    expect(parseClientMessage({ type: "companion_reply", requesterGuestId: "", accepted: true })).toBeNull();
    expect(parseClientMessage({ type: "companion_reply", requesterGuestId: "guest_one", accepted: "yes" })).toBeNull();
    expect(parseClientMessage({ type: "companion_destination", targetGuestId: "guest_two", portalId: "", destinationZoneId: "neighborhood" })).toBeNull();
  });

  it("rejects an unknown move zone", () => {
    expect(parseClientMessage({
      type: "move",
      x: 48,
      y: 72,
      direction: "down",
      moving: true,
      seq: 7,
      zoneId: "parking"
    })).toBeNull();
  });

  it("accepts every guest-route world zone", () => {
    expect(worldZoneIds).toEqual([
      "home",
      "neighborhood",
      "subway-station",
      "subway-train",
      "venue-exterior",
      "lobby",
      "bridal-room",
      "ceremony-hall",
      "banquet",
      "restroom"
    ]);

    for (const zoneId of worldZoneIds) {
      expect(parseClientMessage({
        type: "join",
        nickname: "민지",
        appearance: defaultCharacterAppearance,
        zoneId
      })).not.toBeNull();
      expect(parseClientMessage({
        type: "move",
        x: 45,
        y: 45,
        direction: "right",
        moving: true,
        seq: 1,
        zoneId
      })).not.toBeNull();
    }
  });

  it("rejects the retired four-zone world ids", () => {
    for (const zoneId of ["entrance", "ceremony", "gallery", "lounge"]) {
      expect(parseClientMessage({
        type: "join",
        nickname: "민지",
        appearance: defaultCharacterAppearance,
        zoneId
      })).toBeNull();
    }
  });

  it("rejects non-finite move coordinates", () => {
    expect(parseClientMessage({
      type: "move",
      x: Infinity,
      y: 72,
      direction: "down",
      moving: true,
      seq: 7
    })).toBeNull();
    expect(parseClientMessage({
      type: "move",
      x: 48,
      y: NaN,
      direction: "down",
      moving: true,
      seq: 7
    })).toBeNull();
  });

  it("rejects malformed messages", () => {
    expect(parseClientMessage({ type: "move", x: "bad" })).toBeNull();
    expect(parseClientMessage({ type: "unknown" })).toBeNull();
  });
});
