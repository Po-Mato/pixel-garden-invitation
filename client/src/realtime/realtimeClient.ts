import {
  parseCharacterAppearance,
  type ClientMessage,
  type Direction,
  type ServerMessage
} from "@wedding-game/shared";

type MoveMessage = Extract<ClientMessage, { type: "move" }>;
type JoinMessage = Extract<ClientMessage, { type: "join" }>;

const directions = new Set<Direction>(["up", "down", "left", "right"]);
const serverErrorCodes = new Set<Extract<ServerMessage, { type: "error" }>["code"]>([
  "bad_message",
  "room_full",
  "rate_limited"
]);

export type RealtimeHandlers = {
  onOpen: () => void;
  onClose: () => void;
  onMessage: (message: ServerMessage) => void;
};

export function getRoomUrl(workerUrl: string, invitationId: string) {
  const url = new URL(workerUrl);

  if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol !== "wss:" && url.protocol !== "ws:") {
    throw new TypeError(`Unsupported realtime worker URL scheme: ${url.protocol}`);
  }

  url.pathname = `/rooms/${encodeURIComponent(invitationId)}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function createMoveThrottle(send: (message: MoveMessage) => void, intervalMs: number) {
  let lastSentAt = Number.NEGATIVE_INFINITY;

  return (message: MoveMessage, now: number) => {
    if (now - lastSentAt < intervalMs) {
      return;
    }

    lastSentAt = now;
    send(message);
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositionState(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    directions.has(value.direction as Direction) &&
    typeof value.moving === "boolean" &&
    typeof value.seq === "number" &&
    Number.isInteger(value.seq)
  );
}

function isRoomGuest(value: unknown) {
  if (!isRecord(value) || !isPositionState(value)) return false;
  const appearance = parseCharacterAppearance(value.appearance);
  return (
    typeof value.guestId === "string" &&
    typeof value.nickname === "string" &&
    appearance !== null &&
    typeof value.lastSeenAt === "number" &&
    Number.isFinite(value.lastSeenAt)
  );
}

function parseServerMessage(value: unknown): ServerMessage | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;

  if (value.type === "welcome") {
    if (typeof value.guestId !== "string" || !Array.isArray(value.guests) || !value.guests.every(isRoomGuest)) return null;
    return value as ServerMessage;
  }

  if (value.type === "guest_joined") {
    if (!isRoomGuest(value.guest)) return null;
    return value as ServerMessage;
  }

  if (value.type === "guest_moved") {
    if (typeof value.guestId !== "string" || !isPositionState(value.position)) return null;
    return value as ServerMessage;
  }

  if (value.type === "guest_left") {
    if (typeof value.guestId !== "string") return null;
    return value as ServerMessage;
  }

  if (value.type === "room_state") {
    if (!Array.isArray(value.guests) || !value.guests.every(isRoomGuest)) return null;
    return value as ServerMessage;
  }

  if (value.type === "error") {
    if (!serverErrorCodes.has(value.code as Extract<ServerMessage, { type: "error" }>["code"])) return null;
    return value as ServerMessage;
  }

  return null;
}

export function connectRealtime(url: string, join: JoinMessage, handlers: RealtimeHandlers) {
  const socket = new WebSocket(url);
  let closeNotified = false;

  const notifyClose = () => {
    if (closeNotified) {
      return;
    }

    closeNotified = true;
    handlers.onClose();
  };

  socket.addEventListener("open", () => {
    handlers.onOpen();
    socket.send(JSON.stringify(join));
  });

  socket.addEventListener("close", () => {
    notifyClose();
  });

  socket.addEventListener("error", () => {
    notifyClose();
  });

  socket.addEventListener("message", (event) => {
    try {
      const message = parseServerMessage(JSON.parse(event.data));
      handlers.onMessage(message ?? { type: "error", code: "bad_message" });
    } catch {
      handlers.onMessage({ type: "error", code: "bad_message" });
    }
  });

  return {
    send(message: ClientMessage) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    },
    close() {
      socket.close();
    }
  };
}
