import {
  clampNumber,
  parseCharacterAppearance,
  parseClientMessage,
  realtimeWorldContract,
  type ClientMessage,
  type RoomGuest,
  type ServerMessage,
  type WorldZoneId,
  worldZoneIds
} from "@wedding-game/shared";

type GuestAttachment = {
  kind: "guest";
  guest: RoomGuest;
  lastMoveAt: number;
  lastMoveBypassAt: number;
};

type PendingAttachment = { kind: "pending" };
type SocketAttachment = GuestAttachment | PendingAttachment;

const moveThrottleMs = 100;
const roomCapacity = 100;
const zones = new Set<WorldZoneId>(worldZoneIds);

function clampMovePosition(zoneId: WorldZoneId, x: number, y: number): { x: number; y: number } {
  const { bounds } = realtimeWorldContract[zoneId];
  return {
    x: clampNumber(x, 0, bounds.width),
    y: clampNumber(y, 0, bounds.height)
  };
}

export function createGuestSnapshot(
  guestId: string,
  message: Extract<ClientMessage, { type: "join" }>,
  now: number
): RoomGuest {
  const { spawn } = realtimeWorldContract[message.zoneId];

  return {
    guestId,
    nickname: message.nickname,
    appearance: message.appearance,
    x: spawn.x,
    y: spawn.y,
    direction: "down",
    moving: false,
    seq: 0,
    zoneId: message.zoneId,
    lastSeenAt: now
  };
}

function encode(message: ServerMessage): string {
  return JSON.stringify(message);
}

function parseRawMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== "string") return null;

  try {
    return parseClientMessage(JSON.parse(raw));
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseGuestAttachment(value: unknown): GuestAttachment | null {
  if (!isRecord(value) || value.kind !== "guest" || !isRecord(value.guest)) return null;
  const guest = value.guest;
  const appearance = parseCharacterAppearance(guest.appearance);

  if (
    typeof guest.guestId !== "string" ||
    typeof guest.nickname !== "string" ||
    !appearance ||
    typeof guest.x !== "number" ||
    !Number.isFinite(guest.x) ||
    typeof guest.y !== "number" ||
    !Number.isFinite(guest.y) ||
    (guest.direction !== "up" && guest.direction !== "down" && guest.direction !== "left" && guest.direction !== "right") ||
    typeof guest.moving !== "boolean" ||
    typeof guest.seq !== "number" ||
    !Number.isInteger(guest.seq) ||
    !zones.has(guest.zoneId as WorldZoneId) ||
    typeof guest.lastSeenAt !== "number" ||
    !Number.isFinite(guest.lastSeenAt) ||
    typeof value.lastMoveAt !== "number"
  ) {
    return null;
  }

  return {
    kind: "guest",
    guest: {
      guestId: guest.guestId,
      nickname: guest.nickname,
      appearance,
      x: guest.x,
      y: guest.y,
      direction: guest.direction,
      moving: guest.moving,
      seq: guest.seq,
      zoneId: guest.zoneId as WorldZoneId,
      lastSeenAt: guest.lastSeenAt
    },
    lastMoveAt: value.lastMoveAt,
    lastMoveBypassAt: typeof value.lastMoveBypassAt === "number"
      ? value.lastMoveBypassAt
      : Number.NEGATIVE_INFINITY
  };
}

function readGuestAttachment(socket: WebSocket): GuestAttachment | null {
  return parseGuestAttachment(socket.deserializeAttachment());
}

export class GardenRoom {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request?: Request): Promise<Response> {
    if (!request) {
      return new Response("Garden room is running", {
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }

    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ kind: "pending" } satisfies PendingAttachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): void {
    this.handleMessage(socket, raw);
  }

  private handleMessage(socket: WebSocket, raw: unknown): void {
    const parsed = parseRawMessage(raw);
    if (!parsed) {
      socket.send(encode({ type: "error", code: "bad_message" }));
      return;
    }

    if (parsed.type === "join") {
      if (readGuestAttachment(socket)) {
        socket.send(encode({ type: "error", code: "bad_message" }));
        return;
      }

      if (this.getGuests().length >= roomCapacity) {
        socket.send(encode({ type: "error", code: "room_full" }));
        socket.close(1013, "room full");
        return;
      }

      const guestId = `guest_${crypto.randomUUID()}`;
      const guest = createGuestSnapshot(guestId, parsed, Date.now());
      socket.serializeAttachment({
        kind: "guest",
        guest,
        lastMoveAt: Number.NEGATIVE_INFINITY,
        lastMoveBypassAt: Number.NEGATIVE_INFINITY
      } satisfies GuestAttachment);
      socket.send(encode({ type: "welcome", guestId, guests: this.getGuests() }));
      this.broadcast({ type: "guest_joined", guest }, socket);
      return;
    }

    const current = readGuestAttachment(socket);
    if (!current) {
      socket.send(encode({ type: "error", code: "bad_message" }));
      return;
    }

    if (parsed.type === "move") {
      const now = Date.now();
      const isInsideMoveThrottle = now - current.lastMoveAt < moveThrottleMs;
      const isSamePositionTerminalStop = !parsed.moving
        && parsed.seq > current.guest.seq
        && parsed.zoneId === current.guest.zoneId
        && parsed.x === current.guest.x
        && parsed.y === current.guest.y
        && (current.guest.moving || parsed.direction !== current.guest.direction);
      const canBypassMoveThrottle = isSamePositionTerminalStop
        && now - current.lastMoveBypassAt >= moveThrottleMs;
      if (isInsideMoveThrottle && !canBypassMoveThrottle) {
        return;
      }

      const clampedPosition = clampMovePosition(parsed.zoneId, parsed.x, parsed.y);
      const position = {
        x: clampedPosition.x,
        y: clampedPosition.y,
        direction: parsed.direction,
        moving: parsed.moving,
        seq: parsed.seq,
        zoneId: parsed.zoneId
      };
      const guest = { ...current.guest, ...position, lastSeenAt: now };
      socket.serializeAttachment({
        kind: "guest",
        guest,
        lastMoveAt: now,
        lastMoveBypassAt: isInsideMoveThrottle ? now : current.lastMoveBypassAt
      } satisfies GuestAttachment);
      this.broadcast({ type: "guest_moved", guestId: guest.guestId, position }, socket);
      return;
    }

    if (parsed.type === "ping") {
      socket.serializeAttachment({
        ...current,
        guest: { ...current.guest, lastSeenAt: Date.now() }
      } satisfies GuestAttachment);
      return;
    }

    if (parsed.type === "leave") {
      this.disconnect(socket);
      socket.close(1000, "client leave");
    }
  }

  webSocketClose(socket: WebSocket): void {
    this.disconnect(socket);
  }

  webSocketError(socket: WebSocket): void {
    this.disconnect(socket);
    socket.close(1011, "websocket error");
  }

  private getGuests(): RoomGuest[] {
    return this.state.getWebSockets().flatMap((socket) => {
      const attachment = readGuestAttachment(socket);
      return attachment ? [attachment.guest] : [];
    });
  }

  private broadcast(message: ServerMessage, except?: WebSocket): void {
    const payload = encode(message);
    const failedSockets: WebSocket[] = [];

    for (const socket of this.state.getWebSockets()) {
      if (socket === except) {
        continue;
      }

      if (!readGuestAttachment(socket)) continue;

      try {
        socket.send(payload);
      } catch {
        failedSockets.push(socket);
      }
    }

    for (const socket of failedSockets) {
      this.disconnect(socket);
      socket.close(1011, "broadcast failed");
    }
  }

  private disconnect(socket: WebSocket): void {
    const current = readGuestAttachment(socket);
    if (!current) return;

    socket.serializeAttachment({ kind: "pending" } satisfies SocketAttachment);
    this.broadcast({ type: "guest_left", guestId: current.guest.guestId }, socket);
  }
}
