import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCharacterAppearance, type RoomGuest } from "@wedding-game/shared";
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
    appearance: defaultCharacterAppearance
  });
}

function moveMessage(seq: number, x: number): string {
  return JSON.stringify({
    type: "move",
    x,
    y: 520,
    direction: "right",
    moving: true,
    seq
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GardenRoom helpers", () => {
  it("creates a room guest snapshot", () => {
    expect(createGuestSnapshot("guest_1", {
      type: "join",
      nickname: "하객1",
      appearance: defaultCharacterAppearance
    }, 1000)).toMatchObject({
      guestId: "guest_1",
      nickname: "하객1",
      appearance: defaultCharacterAppearance,
      x: 195,
      y: 525,
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
      appearance: defaultCharacterAppearance
    }, 1000)]]);
    removeGuest(guests, "guest_1");
    expect(guests.size).toBe(0);
  });
});

describe("GardenRoom socket behavior", () => {
  it("broadcasts appearance without legacy avatar fields", () => {
    const room = createRoom();
    const socket = new TestSocket();

    room.handleMessage(asWebSocket(socket), joinMessage("하객1"));

    const welcome = JSON.parse(socket.sent[0]);
    expect(welcome.guests[0].appearance).toEqual(defaultCharacterAppearance);
    expect(welcome.guests[0]).not.toHaveProperty("avatar");
    expect(welcome.guests[0]).not.toHaveProperty("color");
  });

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

  it("throttles move broadcasts and state updates per socket", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);
    const room = createRoom();
    const moving = new TestSocket();
    const watching = new TestSocket();

    room.handleMessage(asWebSocket(moving), joinMessage("moving"));
    room.handleMessage(asWebSocket(watching), joinMessage("watching"));
    watching.sent.length = 0;

    nowSpy.mockReturnValue(2000);
    room.handleMessage(asWebSocket(moving), moveMessage(1, 200));

    nowSpy.mockReturnValue(2050);
    room.handleMessage(asWebSocket(moving), moveMessage(2, 220));

    const movingGuestId = room.sockets.get(asWebSocket(moving))?.guestId;
    expect(watching.sent.map((payload) => JSON.parse(payload)).filter((message) => message.type === "guest_moved")).toHaveLength(1);
    expect(movingGuestId ? room.guests.get(movingGuestId)?.x : undefined).toBe(200);

    nowSpy.mockReturnValue(2100);
    room.handleMessage(asWebSocket(moving), moveMessage(3, 240));

    const moveBroadcasts = watching.sent.map((payload) => JSON.parse(payload)).filter((message) => message.type === "guest_moved");
    expect(moveBroadcasts).toHaveLength(2);
    expect(moveBroadcasts.map((message) => message.position.seq)).toEqual([1, 3]);
    expect(movingGuestId ? room.guests.get(movingGuestId)?.x : undefined).toBe(240);
  });
});
