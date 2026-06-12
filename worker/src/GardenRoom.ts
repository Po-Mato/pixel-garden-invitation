import {
  clampNumber,
  parseClientMessage,
  type ClientMessage,
  type RoomGuest,
  type ServerMessage
} from "@wedding-game/shared";

type GuestSocket = {
  guestId: string;
  socket: WebSocket;
  lastMoveAt: number;
};

const spawn = { x: 195, y: 520 };
const bounds = { minX: 0, maxX: 390, minY: 0, maxY: 720 };
const moveThrottleMs = 100;

export function createGuestSnapshot(
  guestId: string,
  message: Extract<ClientMessage, { type: "join" }>,
  now: number
): RoomGuest {
  return {
    guestId,
    nickname: message.nickname,
    avatar: message.avatar,
    color: message.color,
    x: spawn.x,
    y: spawn.y,
    direction: "down",
    moving: false,
    seq: 0,
    lastSeenAt: now
  };
}

export function removeGuest(guests: Map<string, RoomGuest>, guestId: string): void {
  guests.delete(guestId);
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

export class GardenRoom {
  private readonly guests = new Map<string, RoomGuest>();
  private readonly sockets = new Map<WebSocket, GuestSocket>();

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
    this.acceptSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  private acceptSocket(socket: WebSocket): void {
    socket.accept();
    socket.addEventListener("message", (event) => this.handleMessage(socket, event.data));
    socket.addEventListener("close", () => this.disconnect(socket));
    socket.addEventListener("error", () => this.disconnect(socket));
  }

  private handleMessage(socket: WebSocket, raw: unknown): void {
    const parsed = parseRawMessage(raw);
    if (!parsed) {
      socket.send(encode({ type: "error", code: "bad_message" }));
      return;
    }

    if (parsed.type === "join") {
      if (this.sockets.has(socket)) {
        socket.send(encode({ type: "error", code: "bad_message" }));
        return;
      }

      const guestId = `guest_${crypto.randomUUID()}`;
      const guest = createGuestSnapshot(guestId, parsed, Date.now());
      this.guests.set(guestId, guest);
      this.sockets.set(socket, { guestId, socket, lastMoveAt: Number.NEGATIVE_INFINITY });
      socket.send(encode({ type: "welcome", guestId, guests: [...this.guests.values()] }));
      this.broadcast({ type: "guest_joined", guest }, socket);
      return;
    }

    const current = this.sockets.get(socket);
    if (!current) {
      socket.send(encode({ type: "error", code: "bad_message" }));
      return;
    }

    if (parsed.type === "move") {
      const guest = this.guests.get(current.guestId);
      if (!guest) return;

      const now = Date.now();
      if (now - current.lastMoveAt < moveThrottleMs) {
        return;
      }

      current.lastMoveAt = now;
      const position = {
        x: clampNumber(parsed.x, bounds.minX, bounds.maxX),
        y: clampNumber(parsed.y, bounds.minY, bounds.maxY),
        direction: parsed.direction,
        moving: parsed.moving,
        seq: parsed.seq
      };
      this.guests.set(current.guestId, { ...guest, ...position, lastSeenAt: now });
      this.broadcast({ type: "guest_moved", guestId: current.guestId, position }, socket);
      return;
    }

    if (parsed.type === "ping") {
      const guest = this.guests.get(current.guestId);
      if (guest) {
        this.guests.set(current.guestId, { ...guest, lastSeenAt: Date.now() });
      }
      return;
    }

    if (parsed.type === "leave") {
      this.disconnect(socket);
    }
  }

  private broadcast(message: ServerMessage, except?: WebSocket): void {
    const payload = encode(message);
    const failedSockets: WebSocket[] = [];

    for (const { socket } of [...this.sockets.values()]) {
      if (socket === except) {
        continue;
      }

      try {
        socket.send(payload);
      } catch {
        failedSockets.push(socket);
      }
    }

    for (const socket of failedSockets) {
      this.disconnect(socket);
    }
  }

  private disconnect(socket: WebSocket): void {
    const current = this.sockets.get(socket);
    if (!current) return;

    this.sockets.delete(socket);
    removeGuest(this.guests, current.guestId);
    this.broadcast({ type: "guest_left", guestId: current.guestId });
  }
}
