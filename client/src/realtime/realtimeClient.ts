import {
  parseCharacterAppearance,
  guestReactionIds,
  type ClientMessage,
  type Direction,
  type GuestReaction,
  type RoomGuest,
  type ServerMessage,
  type WorldZoneId,
  worldZoneIds
} from "@wedding-game/shared";

type MoveMessage = Extract<ClientMessage, { type: "move" }>;
type JoinMessage = Extract<ClientMessage, { type: "join" }>;

const directions = new Set<Direction>(["up", "down", "left", "right"]);
const zones = new Set<WorldZoneId>(worldZoneIds);
const reactions = new Set<GuestReaction>(guestReactionIds);
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

export type RealtimeRetryOptions = {
  initialDelayMs?: number;
  maxDelayMs?: number;
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
    zones.has(value.zoneId as WorldZoneId) &&
    typeof value.moving === "boolean" &&
    typeof value.seq === "number" &&
    Number.isInteger(value.seq)
  );
}

function normalizeRoomGuest(value: unknown): RoomGuest | null {
  if (!isRecord(value) || !isPositionState(value)) return null;
  const appearance = parseCharacterAppearance(value.appearance);
  if (
    typeof value.guestId !== "string" ||
    typeof value.nickname !== "string" ||
    typeof value.lastSeenAt !== "number" ||
    !Number.isFinite(value.lastSeenAt)
  ) {
    return null;
  }

  return {
    guestId: value.guestId,
    nickname: value.nickname,
    appearance,
    x: value.x as number,
    y: value.y as number,
    direction: value.direction as Direction,
    moving: value.moving as boolean,
    seq: value.seq as number,
    zoneId: value.zoneId as WorldZoneId,
    lastSeenAt: value.lastSeenAt as number
  };
}

function parseServerMessage(value: unknown): ServerMessage | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;

  if (value.type === "welcome") {
    if (typeof value.guestId !== "string" || !Array.isArray(value.guests)) return null;
    const guests = value.guests.map(normalizeRoomGuest);
    if (guests.some((guest) => guest === null)) return null;
    return { type: "welcome", guestId: value.guestId, guests: guests as RoomGuest[] };
  }

  if (value.type === "guest_joined") {
    const guest = normalizeRoomGuest(value.guest);
    if (!guest) return null;
    return { type: "guest_joined", guest };
  }

  if (value.type === "guest_moved") {
    if (typeof value.guestId !== "string" || !isPositionState(value.position)) return null;
    return value as ServerMessage;
  }

  if (value.type === "guest_reacted") {
    if (
      typeof value.guestId !== "string" ||
      !reactions.has(value.reaction as GuestReaction) ||
      !zones.has(value.zoneId as WorldZoneId)
    ) return null;
    return value as ServerMessage;
  }

  if (value.type === "guest_left") {
    if (typeof value.guestId !== "string") return null;
    return value as ServerMessage;
  }

  if (value.type === "room_state") {
    if (!Array.isArray(value.guests)) return null;
    const guests = value.guests.map(normalizeRoomGuest);
    if (guests.some((guest) => guest === null)) return null;
    return { type: "room_state", guests: guests as RoomGuest[] };
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
    socket.close();
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

export function connectRealtimeWithRetry(
  url: string,
  getJoin: () => JoinMessage,
  handlers: RealtimeHandlers,
  options: RealtimeRetryOptions = {}
) {
  const initialDelayMs = options.initialDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  let stopped = false;
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let connection: ReturnType<typeof connectRealtime> | null = null;

  const scheduleRetry = () => {
    if (stopped || retryTimer !== null) return;
    const delay = Math.min(initialDelayMs * (2 ** retryAttempt), maxDelayMs);
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      openConnection();
    }, delay);
  };

  const openConnection = () => {
    if (stopped) return;

    let candidate: ReturnType<typeof connectRealtime>;
    try {
      candidate = connectRealtime(url, getJoin(), {
        onOpen: () => {
          if (stopped || connection !== candidate) return;
          retryAttempt = 0;
          handlers.onOpen();
        },
        onClose: () => {
          if (stopped || connection !== candidate) return;
          connection = null;
          handlers.onClose();
          scheduleRetry();
        },
        onMessage: (message) => {
          if (stopped || connection !== candidate) return;

          handlers.onMessage(message);
          if (message.type === "error" && message.code === "room_full") {
            stopped = true;
            connection = null;
            candidate.close();
          }
        }
      });
      connection = candidate;
    } catch {
      connection = null;
      handlers.onClose();
      scheduleRetry();
    }
  };

  openConnection();

  return {
    send(message: ClientMessage) {
      connection?.send(message);
    },
    close() {
      stopped = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      const activeConnection = connection;
      connection = null;
      activeConnection?.close();
    }
  };
}
