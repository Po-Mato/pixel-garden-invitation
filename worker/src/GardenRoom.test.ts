import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCharacterAppearance, type RoomGuest } from "@wedding-game/shared";
import { createGuestSnapshot, GardenRoom } from "./GardenRoom";

type GardenRoomHarness = {
  webSocketMessage(socket: WebSocket, raw: unknown): void;
  webSocketClose(socket: WebSocket, code: number, reason: string, wasClean: boolean): void;
  webSocketError(socket: WebSocket, error: unknown): void;
};

class TestSocket {
  readonly sent: string[] = [];
  failSends = false;
  closed = false;
  private attachment: unknown = null;
  onClose: (() => void) | null = null;

  send(payload: string): void {
    if (this.failSends) {
      throw new Error("socket send failed");
    }
    this.sent.push(payload);
  }

  close(): void {
    this.closed = true;
    this.onClose?.();
  }

  serializeAttachment(attachment: unknown): void {
    this.attachment = structuredClone(attachment);
  }

  deserializeAttachment(): unknown {
    return structuredClone(this.attachment);
  }
}

class TestState {
  readonly sockets: TestSocket[] = [];

  addSocket(socket: TestSocket): void {
    if (this.sockets.includes(socket)) return;
    this.sockets.push(socket);
    socket.onClose = () => {
      const index = this.sockets.indexOf(socket);
      if (index >= 0) this.sockets.splice(index, 1);
    };
  }

  acceptWebSocket(socket: WebSocket): void {
    this.addSocket(socket as unknown as TestSocket);
  }

  getWebSockets(): WebSocket[] {
    return this.sockets.map(asWebSocket);
  }
}

function createRoom(state = new TestState()): GardenRoomHarness {
  return new GardenRoom(state as unknown as DurableObjectState) as unknown as GardenRoomHarness;
}

function asWebSocket(socket: TestSocket): WebSocket {
  return socket as unknown as WebSocket;
}

function joinGuest(room: GardenRoomHarness, state: TestState, socket: TestSocket, nickname: string): void {
  state.addSocket(socket);
  room.webSocketMessage(asWebSocket(socket), joinMessage(nickname));
}

function joinMessage(nickname: string): string {
  return JSON.stringify({
    type: "join",
    nickname,
    appearance: defaultCharacterAppearance,
    zoneId: "home"
  });
}

function moveMessage(
  seq: number,
  x: number,
  zoneId = "home",
  y = 520,
  moving = true,
  direction = "right"
): string {
  return JSON.stringify({
    type: "move",
    x,
    y,
    direction,
    moving,
    seq,
    zoneId
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
      appearance: defaultCharacterAppearance,
      zoneId: "home"
    }, 1000)).toMatchObject({
      guestId: "guest_1",
      nickname: "하객1",
      appearance: defaultCharacterAppearance,
      x: 135,
      y: 405,
      direction: "down",
      moving: false,
      seq: 0,
      zoneId: "home",
      lastSeenAt: 1000
    });
  });

  it("creates a subway station guest at the client world spawn", () => {
    expect(createGuestSnapshot("guest_station", {
      type: "join",
      nickname: "역사 하객",
      appearance: defaultCharacterAppearance,
      zoneId: "subway-station"
    }, 1000)).toMatchObject({
      x: 135,
      y: 435,
      zoneId: "subway-station"
    });
  });

  it("creates a subway train guest at the client world spawn", () => {
    expect(createGuestSnapshot("guest_train", {
      type: "join",
      nickname: "열차 하객",
      appearance: defaultCharacterAppearance,
      zoneId: "subway-train"
    }, 1000)).toMatchObject({
      x: 135,
      y: 285,
      zoneId: "subway-train"
    });
  });

  it("creates a venue exterior guest at the Task 9 client world spawn", () => {
    expect(createGuestSnapshot("guest_venue", {
      type: "join",
      nickname: "예식장 하객",
      appearance: defaultCharacterAppearance,
      zoneId: "venue-exterior"
    }, 1000)).toMatchObject({
      x: 465,
      y: 765,
      zoneId: "venue-exterior"
    });
  });

  it("keeps the transitional lobby default spawn until Task 10", () => {
    expect(createGuestSnapshot("guest_lobby", {
      type: "join",
      nickname: "로비 하객",
      appearance: defaultCharacterAppearance,
      zoneId: "lobby"
    }, 1000)).toMatchObject({
      x: 105,
      y: 405,
      zoneId: "lobby"
    });
  });

});

describe("GardenRoom socket behavior", () => {
  it("broadcasts appearance without legacy avatar fields", () => {
    const state = new TestState();
    const statefulRoom = createRoom(state);
    const socket = new TestSocket();

    joinGuest(statefulRoom, state, socket, "하객1");

    const welcome = JSON.parse(socket.sent[0]);
    expect(welcome.guests[0].appearance).toEqual(defaultCharacterAppearance);
    expect(welcome.guests[0]).not.toHaveProperty("avatar");
    expect(welcome.guests[0]).not.toHaveProperty("color");
  });

  it("does not orphan a guest when the same socket joins twice", () => {
    const state = new TestState();
    const room = createRoom(state);
    const socket = new TestSocket();

    joinGuest(room, state, socket, "하객1");
    room.webSocketMessage(asWebSocket(socket), joinMessage("하객2"));

    const attachment = socket.deserializeAttachment() as { guest?: RoomGuest } | null;
    expect(attachment?.guest?.nickname).toBe("하객1");
    expect(JSON.parse(socket.sent.at(-1) ?? "{}")).toEqual({ type: "error", code: "bad_message" });
  });

  it("prunes a peer whose socket throws during broadcast", () => {
    const state = new TestState();
    const room = createRoom(state);
    const stale = new TestSocket();
    const joining = new TestSocket();

    joinGuest(room, state, stale, "stale");
    stale.failSends = true;

    expect(() => joinGuest(room, state, joining, "joining")).not.toThrow();
    expect(stale.closed).toBe(true);
    expect(state.getWebSockets()).toEqual([asWebSocket(joining)]);
  });

  it("throttles move broadcasts and state updates per socket", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);
    const state = new TestState();
    const room = createRoom(state);
    const moving = new TestSocket();
    const watching = new TestSocket();

    joinGuest(room, state, moving, "moving");
    joinGuest(room, state, watching, "watching");
    watching.sent.length = 0;

    nowSpy.mockReturnValue(2000);
    room.webSocketMessage(asWebSocket(moving), moveMessage(1, 200));

    nowSpy.mockReturnValue(2050);
    room.webSocketMessage(asWebSocket(moving), moveMessage(2, 220));

    const movingGuestId = (moving.deserializeAttachment() as { guest?: RoomGuest } | null)?.guest?.guestId;
    expect(watching.sent.map((payload) => JSON.parse(payload)).filter((message) => message.type === "guest_moved")).toHaveLength(1);
    expect((moving.deserializeAttachment() as { guest?: RoomGuest } | null)?.guest?.x).toBe(200);

    nowSpy.mockReturnValue(2100);
    room.webSocketMessage(asWebSocket(moving), moveMessage(3, 240));

    const moveBroadcasts = watching.sent.map((payload) => JSON.parse(payload)).filter((message) => message.type === "guest_moved");
    expect(moveBroadcasts).toHaveLength(2);
    expect(moveBroadcasts.map((message) => message.position.seq)).toEqual([1, 3]);
    expect((moving.deserializeAttachment() as { guest?: RoomGuest } | null)?.guest?.x).toBe(240);
    expect(movingGuestId).toBeTypeOf("string");
  });

  it("accepts only a same-position terminal stop inside the move throttle window", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);
    const state = new TestState();
    const room = createRoom(state);
    const moving = new TestSocket();
    const watching = new TestSocket();

    joinGuest(room, state, moving, "moving");
    joinGuest(room, state, watching, "watching");
    watching.sent.length = 0;

    nowSpy.mockReturnValue(2000);
    room.webSocketMessage(asWebSocket(moving), moveMessage(1, 200));

    nowSpy.mockReturnValue(2050);
    room.webSocketMessage(asWebSocket(moving), moveMessage(2, 200, "home", 520, false));
    room.webSocketMessage(asWebSocket(moving), moveMessage(3, 220));

    let attachment = moving.deserializeAttachment() as { guest?: RoomGuest; lastMoveAt?: number } | null;
    let moveBroadcasts = watching.sent
      .map((payload) => JSON.parse(payload))
      .filter((message) => message.type === "guest_moved");

    expect(moveBroadcasts.map((message) => message.position)).toEqual([
      expect.objectContaining({ x: 200, y: 520, moving: true, seq: 1, zoneId: "home" }),
      expect.objectContaining({ x: 200, y: 520, moving: false, seq: 2, zoneId: "home" })
    ]);
    expect(attachment).toMatchObject({
      guest: { x: 200, y: 520, moving: false, seq: 2, zoneId: "home" },
      lastMoveAt: 2050
    });

    nowSpy.mockReturnValue(2450);
    room.webSocketMessage(asWebSocket(moving), moveMessage(3, 135, "neighborhood", 285, false));

    attachment = moving.deserializeAttachment() as { guest?: RoomGuest; lastMoveAt?: number } | null;
    moveBroadcasts = watching.sent
      .map((payload) => JSON.parse(payload))
      .filter((message) => message.type === "guest_moved");

    expect(moveBroadcasts.map((message) => message.position.seq)).toEqual([1, 2, 3]);
    expect(moveBroadcasts.at(-1)?.position).toMatchObject({
      x: 135,
      y: 285,
      moving: false,
      seq: 3,
      zoneId: "neighborhood"
    });
    expect(attachment).toMatchObject({
      guest: { x: 135, y: 285, moving: false, seq: 3, zoneId: "neighborhood" },
      lastMoveAt: 2450
    });
  });

  it("accepts a same-position portal-facing update when the guest is already stopped", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);
    const state = new TestState();
    const room = createRoom(state);
    const moving = new TestSocket();
    const watching = new TestSocket();

    joinGuest(room, state, moving, "moving");
    joinGuest(room, state, watching, "watching");
    watching.sent.length = 0;

    nowSpy.mockReturnValue(2000);
    room.webSocketMessage(asWebSocket(moving), moveMessage(1, 200, "home", 520, false, "right"));

    nowSpy.mockReturnValue(2050);
    room.webSocketMessage(asWebSocket(moving), moveMessage(2, 200, "home", 520, false, "up"));
    nowSpy.mockReturnValue(2075);
    room.webSocketMessage(asWebSocket(moving), moveMessage(3, 200, "home", 520, false, "right"));

    const attachment = moving.deserializeAttachment() as { guest?: RoomGuest; lastMoveAt?: number } | null;
    const moveBroadcasts = watching.sent
      .map((payload) => JSON.parse(payload))
      .filter((message) => message.type === "guest_moved");

    expect(moveBroadcasts.map((message) => message.position)).toEqual([
      expect.objectContaining({ moving: false, direction: "right", seq: 1 }),
      expect.objectContaining({ moving: false, direction: "up", seq: 2 })
    ]);
    expect(attachment).toMatchObject({
      guest: { x: 200, y: 520, moving: false, direction: "up", seq: 2, zoneId: "home" },
      lastMoveAt: 2050
    });
  });

  it("broadcasts zone transitions and clamps coordinates inside that zone", () => {
    vi.spyOn(Date, "now").mockReturnValue(2000);
    const state = new TestState();
    const room = createRoom(state);
    const moving = new TestSocket();
    const watching = new TestSocket();

    joinGuest(room, state, moving, "moving");
    joinGuest(room, state, watching, "watching");
    watching.sent.length = 0;

    room.webSocketMessage(asWebSocket(moving), moveMessage(1, 2000, "banquet", -50));

    const broadcast = watching.sent.map((payload) => JSON.parse(payload)).find((message) => message.type === "guest_moved");

    expect(broadcast.position).toEqual({
      x: 1080,
      y: 0,
      direction: "right",
      moving: true,
      seq: 1,
      zoneId: "banquet"
    });
    expect((moving.deserializeAttachment() as { guest?: RoomGuest } | null)?.guest?.zoneId).toBe("banquet");
  });

  it("keeps the subway station east portal approach inside the worker bounds", () => {
    vi.spyOn(Date, "now").mockReturnValue(2000);
    const state = new TestState();
    const room = createRoom(state);
    const moving = new TestSocket();
    const watching = new TestSocket();

    joinGuest(room, state, moving, "moving");
    joinGuest(room, state, watching, "watching");
    watching.sent.length = 0;

    room.webSocketMessage(asWebSocket(moving), moveMessage(1, 735, "subway-station", 435));

    const broadcast = watching.sent.map((payload) => JSON.parse(payload)).find((message) => message.type === "guest_moved");
    expect(broadcast.position).toMatchObject({ x: 735, y: 435, zoneId: "subway-station" });
    expect((moving.deserializeAttachment() as { guest?: RoomGuest } | null)?.guest).toMatchObject({
      x: 735,
      y: 435,
      zoneId: "subway-station"
    });
  });

  it("does not clamp the subway train east portal approach", () => {
    vi.spyOn(Date, "now").mockReturnValue(2000);
    const state = new TestState();
    const room = createRoom(state);
    const moving = new TestSocket();
    const watching = new TestSocket();

    joinGuest(room, state, moving, "moving");
    joinGuest(room, state, watching, "watching");
    watching.sent.length = 0;

    room.webSocketMessage(asWebSocket(moving), moveMessage(1, 1335, "subway-train", 285));

    const broadcast = watching.sent.map((payload) => JSON.parse(payload)).find((message) => message.type === "guest_moved");
    expect(broadcast.position).toMatchObject({ x: 1335, y: 285, zoneId: "subway-train" });
    expect((moving.deserializeAttachment() as { guest?: RoomGuest } | null)?.guest).toMatchObject({
      x: 1335,
      y: 285,
      zoneId: "subway-train"
    });
  });

  it("keeps the Task 9 venue portal approaches inside the regular venue bounds", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(2000);
    const state = new TestState();
    const room = createRoom(state);
    const moving = new TestSocket();
    const watching = new TestSocket();

    joinGuest(room, state, moving, "moving");
    joinGuest(room, state, watching, "watching");
    watching.sent.length = 0;

    room.webSocketMessage(asWebSocket(moving), moveMessage(1, 465, "venue-exterior", 795));
    nowSpy.mockReturnValue(2100);
    room.webSocketMessage(asWebSocket(moving), moveMessage(2, 465, "venue-exterior", 105));

    const broadcasts = watching.sent.map((payload) => JSON.parse(payload)).filter((message) => message.type === "guest_moved");
    expect(broadcasts.map((message) => message.position)).toEqual([
      expect.objectContaining({ x: 465, y: 795, zoneId: "venue-exterior" }),
      expect.objectContaining({ x: 465, y: 105, zoneId: "venue-exterior" })
    ]);
    expect((moving.deserializeAttachment() as { guest?: RoomGuest } | null)?.guest).toMatchObject({
      x: 465,
      y: 105,
      zoneId: "venue-exterior"
    });
  });

  it("clamps venue exterior positions outside the Task 9 bounds", () => {
    vi.spyOn(Date, "now").mockReturnValue(2000);
    const state = new TestState();
    const room = createRoom(state);
    const moving = new TestSocket();
    const watching = new TestSocket();

    joinGuest(room, state, moving, "moving");
    joinGuest(room, state, watching, "watching");
    watching.sent.length = 0;

    room.webSocketMessage(asWebSocket(moving), moveMessage(1, 990, "venue-exterior", 960));

    const broadcast = watching.sent.map((payload) => JSON.parse(payload)).find((message) => message.type === "guest_moved");
    expect(broadcast.position).toMatchObject({ x: 960, y: 900, zoneId: "venue-exterior" });
    expect((moving.deserializeAttachment() as { guest?: RoomGuest } | null)?.guest).toMatchObject({
      x: 960,
      y: 900,
      zoneId: "venue-exterior"
    });
  });

  it("does not clamp the Task 9 portal destination coordinates", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(2000);
    const state = new TestState();
    const room = createRoom(state);
    const moving = new TestSocket();
    const watching = new TestSocket();

    joinGuest(room, state, moving, "moving");
    joinGuest(room, state, watching, "watching");
    watching.sent.length = 0;

    room.webSocketMessage(asWebSocket(moving), moveMessage(1, 1305, "subway-train", 285));
    nowSpy.mockReturnValue(2100);
    room.webSocketMessage(asWebSocket(moving), moveMessage(2, 525, "lobby", 765));

    const broadcasts = watching.sent.map((payload) => JSON.parse(payload)).filter((message) => message.type === "guest_moved");
    expect(broadcasts.map((message) => message.position)).toEqual([
      expect.objectContaining({ x: 1305, y: 285, zoneId: "subway-train" }),
      expect.objectContaining({ x: 525, y: 765, zoneId: "lobby" })
    ]);
    expect((moving.deserializeAttachment() as { guest?: RoomGuest } | null)?.guest).toMatchObject({
      x: 525,
      y: 765,
      zoneId: "lobby"
    });
  });

  it("recovers joined guests and their latest position after hibernation", () => {
    const state = new TestState();
    const firstRoom = createRoom(state);
    const moving = new TestSocket();

    joinGuest(firstRoom, state, moving, "moving");
    firstRoom.webSocketMessage(asWebSocket(moving), moveMessage(1, 135, "banquet", 405));

    const awakenedRoom = createRoom(state);
    const joining = new TestSocket();
    joinGuest(awakenedRoom, state, joining, "joining");

    const welcome = joining.sent.map((payload) => JSON.parse(payload)).find((message) => message.type === "welcome");
    const recovered = welcome.guests.find((guest: RoomGuest) => guest.nickname === "moving");

    expect(recovered).toMatchObject({ x: 135, y: 405, zoneId: "banquet", seq: 1 });
    expect(moving.sent.map((payload) => JSON.parse(payload))).toContainEqual(
      expect.objectContaining({ type: "guest_joined", guest: expect.objectContaining({ nickname: "joining" }) })
    );
  });

  it("rejects the 101st joined guest without evicting the existing room", () => {
    const state = new TestState();
    const room = createRoom(state);

    for (let index = 1; index <= 100; index += 1) {
      joinGuest(room, state, new TestSocket(), `하객${index}`);
    }

    const overflow = new TestSocket();
    joinGuest(room, state, overflow, "초과 하객");

    expect(overflow.sent.map((payload) => JSON.parse(payload))).toEqual([
      { type: "error", code: "room_full" }
    ]);
    expect(overflow.closed).toBe(true);
    expect(state.getWebSockets()).toHaveLength(100);
  });
});
