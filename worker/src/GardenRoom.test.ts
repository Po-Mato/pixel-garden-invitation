import { describe, expect, it } from "vitest";
import type { RoomGuest } from "@wedding-game/shared";
import { createGuestSnapshot, GardenRoom, removeGuest } from "./GardenRoom";

type GardenRoomHarness = {
  guests: Map<string, RoomGuest>;
  sockets: Map<WebSocket, { guestId: string; socket: WebSocket }>;
  handleMessage(socket: WebSocket, raw: unknown): void;
};

class TestSocket {
  readonly sent: string[] = [];
  failSends = false;

  send(payload: string): void {
    if (this.failSends) {
      throw new Error("socket send failed");
    }
    this.sent.push(payload);
  }
}

function createRoom(): GardenRoomHarness {
  return new GardenRoom({} as DurableObjectState) as unknown as GardenRoomHarness;
}

function asWebSocket(socket: TestSocket): WebSocket {
  return socket as unknown as WebSocket;
}

function joinMessage(nickname: string): string {
  return JSON.stringify({
    type: "join",
    nickname,
    avatar: "classic",
    color: "rose"
  });
}

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

describe("GardenRoom socket behavior", () => {
  it("does not orphan a guest when the same socket joins twice", () => {
    const room = createRoom();
    const socket = new TestSocket();

    room.handleMessage(asWebSocket(socket), joinMessage("하객1"));
    room.handleMessage(asWebSocket(socket), joinMessage("하객2"));

    expect(room.guests.size).toBe(1);
    const joined = room.sockets.get(asWebSocket(socket));
    expect(joined).toBeDefined();
    expect(joined ? room.guests.has(joined.guestId) : false).toBe(true);
  });

  it("prunes a peer whose socket throws during broadcast", () => {
    const room = createRoom();
    const stale = new TestSocket();
    const joining = new TestSocket();

    room.handleMessage(asWebSocket(stale), joinMessage("stale"));
    stale.failSends = true;

    expect(() => room.handleMessage(asWebSocket(joining), joinMessage("joining"))).not.toThrow();
    expect(room.sockets.has(asWebSocket(stale))).toBe(false);
    expect(room.guests.size).toBe(1);

    const remaining = room.sockets.get(asWebSocket(joining));
    expect(remaining).toBeDefined();
    expect(remaining ? room.guests.has(remaining.guestId) : false).toBe(true);
  });
});
