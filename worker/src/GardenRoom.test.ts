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
    zoneId: "ceremony"
  });
}

function moveMessage(seq: number, x: number, zoneId = "ceremony", y = 520): string {
  return JSON.stringify({
    type: "move",
    x,
    y,
    direction: "right",
    moving: true,
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
      zoneId: "ceremony"
    }, 1000)).toMatchObject({
      guestId: "guest_1",
      nickname: "하객1",
      appearance: defaultCharacterAppearance,
      x: 195,
      y: 525,
      direction: "down",
      moving: false,
      seq: 0,
      zoneId: "ceremony",
      lastSeenAt: 1000
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

  it("broadcasts zone transitions and clamps coordinates inside that zone", () => {
    vi.spyOn(Date, "now").mockReturnValue(2000);
    const state = new TestState();
    const room = createRoom(state);
    const moving = new TestSocket();
    const watching = new TestSocket();

    joinGuest(room, state, moving, "moving");
    joinGuest(room, state, watching, "watching");
    watching.sent.length = 0;

    room.webSocketMessage(asWebSocket(moving), moveMessage(1, 999, "lounge", -50));

    const broadcast = watching.sent.map((payload) => JSON.parse(payload)).find((message) => message.type === "guest_moved");

    expect(broadcast.position).toEqual({
      x: 390,
      y: 0,
      direction: "right",
      moving: true,
      seq: 1,
      zoneId: "lounge"
    });
    expect((moving.deserializeAttachment() as { guest?: RoomGuest } | null)?.guest?.zoneId).toBe("lounge");
  });

  it("recovers joined guests and their latest position after hibernation", () => {
    const state = new TestState();
    const firstRoom = createRoom(state);
    const moving = new TestSocket();

    joinGuest(firstRoom, state, moving, "moving");
    firstRoom.webSocketMessage(asWebSocket(moving), moveMessage(1, 135, "lounge", 405));

    const awakenedRoom = createRoom(state);
    const joining = new TestSocket();
    joinGuest(awakenedRoom, state, joining, "joining");

    const welcome = joining.sent.map((payload) => JSON.parse(payload)).find((message) => message.type === "welcome");
    const recovered = welcome.guests.find((guest: RoomGuest) => guest.nickname === "moving");

    expect(recovered).toMatchObject({ x: 135, y: 405, zoneId: "lounge", seq: 1 });
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
