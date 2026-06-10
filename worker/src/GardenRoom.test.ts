import { describe, expect, it } from "vitest";
import { createGuestSnapshot, removeGuest } from "./GardenRoom";

describe("GardenRoom helpers", () => {
  it("creates a room guest snapshot", () => {
    expect(createGuestSnapshot("guest_1", {
      type: "join",
      nickname: "하객1",
      avatar: "classic",
      color: "rose"
    }, 1000)).toMatchObject({
      guestId: "guest_1",
      nickname: "하객1",
      avatar: "classic",
      color: "rose",
      x: 195,
      y: 520,
      direction: "down",
      moving: false,
      seq: 0,
      lastSeenAt: 1000
    });
  });

  it("removes guests by id", () => {
    const guests = new Map([["guest_1", createGuestSnapshot("guest_1", {
      type: "join",
      nickname: "하객1",
      avatar: "classic",
      color: "rose"
    }, 1000)]]);
    removeGuest(guests, "guest_1");
    expect(guests.size).toBe(0);
  });
});
