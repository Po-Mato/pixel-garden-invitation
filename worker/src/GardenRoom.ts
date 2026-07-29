import {
  clampNumber,
  companionRendezvousProposalLifetimeMs,
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
  lastReactionAt: number;
  lastSocialAt: number;
};

type PendingAttachment = { kind: "pending" };
type SocketAttachment = GuestAttachment | PendingAttachment;

const moveThrottleMs = 100;
const reactionThrottleMs = 800;
const socialThrottleMs = 500;
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
      : Number.NEGATIVE_INFINITY,
    lastReactionAt: typeof value.lastReactionAt === "number"
      ? value.lastReactionAt
      : Number.NEGATIVE_INFINITY,
    lastSocialAt: typeof value.lastSocialAt === "number"
      ? value.lastSocialAt
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

      const guestId = parsed.resumeId ? `guest_${parsed.resumeId}` : `guest_${crypto.randomUUID()}`;
      const existing = this.findGuestSocket(guestId);
      if (!existing && this.getGuests().length >= roomCapacity) {
        socket.send(encode({ type: "error", code: "room_full" }));
        socket.close(1013, "room full");
        return;
      }
      if (existing) {
        existing.socket.serializeAttachment({ kind: "pending" } satisfies PendingAttachment);
        existing.socket.close(1000, "guest resumed elsewhere");
      }
      const guest = createGuestSnapshot(guestId, parsed, Date.now());
      socket.serializeAttachment({
        kind: "guest",
        guest,
        lastMoveAt: Number.NEGATIVE_INFINITY,
        lastMoveBypassAt: Number.NEGATIVE_INFINITY,
        lastReactionAt: Number.NEGATIVE_INFINITY,
        lastSocialAt: Number.NEGATIVE_INFINITY
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
        lastMoveBypassAt: isInsideMoveThrottle ? now : current.lastMoveBypassAt,
        lastReactionAt: current.lastReactionAt,
        lastSocialAt: current.lastSocialAt
      } satisfies GuestAttachment);
      this.broadcast({ type: "guest_moved", guestId: guest.guestId, position }, socket);
      return;
    }

    if (
      parsed.type === "companion_invite"
      || parsed.type === "companion_reply"
      || parsed.type === "companion_stop"
      || parsed.type === "companion_destination"
      || parsed.type === "companion_destination_request"
      || parsed.type === "companion_portal_ready"
      || parsed.type === "companion_ping"
      || parsed.type === "companion_rendezvous_propose"
      || parsed.type === "companion_rendezvous_reply"
      || parsed.type === "companion_rendezvous_cancel"
    ) {
      const now = Date.now();
      if (now - current.lastSocialAt < socialThrottleMs) return;
      socket.serializeAttachment({
        ...current,
        guest: { ...current.guest, lastSeenAt: now },
        lastSocialAt: now
      } satisfies GuestAttachment);

      if (parsed.type === "companion_invite") {
        const target = this.findGuestSocket(parsed.targetGuestId);
        if (!target || target.attachment.guest.zoneId !== current.guest.zoneId) return;
        target.socket.send(encode({
          type: "companion_invited",
          requesterGuestId: current.guest.guestId,
          requesterNickname: current.guest.nickname,
          zoneId: current.guest.zoneId
        }));
        return;
      }

      if (parsed.type === "companion_reply") {
        const requester = this.findGuestSocket(parsed.requesterGuestId);
        if (!requester || requester.attachment.guest.zoneId !== current.guest.zoneId) return;
        requester.socket.send(encode({
          type: "companion_replied",
          guestId: current.guest.guestId,
          guestNickname: current.guest.nickname,
          accepted: parsed.accepted,
          zoneId: current.guest.zoneId
        }));
        return;
      }

      if (parsed.type === "companion_destination") {
        const target = this.findGuestSocket(parsed.targetGuestId);
        if (!target || target.attachment.guest.zoneId !== current.guest.zoneId) return;
        target.socket.send(encode({
          type: "companion_destination_set",
          guestId: current.guest.guestId,
          guestNickname: current.guest.nickname,
          portalId: parsed.portalId,
          destinationZoneId: parsed.destinationZoneId,
          zoneId: current.guest.zoneId
        }));
        return;
      }

      if (parsed.type === "companion_destination_request") {
        const target = this.findGuestSocket(parsed.targetGuestId);
        if (!target || target.attachment.guest.zoneId !== current.guest.zoneId) return;
        target.socket.send(encode({
          type: "companion_destination_requested",
          guestId: current.guest.guestId,
          guestNickname: current.guest.nickname,
          zoneId: current.guest.zoneId
        }));
        return;
      }

      if (parsed.type === "companion_ping") {
        const target = this.findGuestSocket(parsed.targetGuestId);
        if (!target || target.attachment.guest.zoneId !== current.guest.zoneId) return;
        target.socket.send(encode({
          type: "companion_pinged",
          guestId: current.guest.guestId,
          guestNickname: current.guest.nickname,
          ping: parsed.ping,
          zoneId: current.guest.zoneId
        }));
        return;
      }

      if (parsed.type === "companion_rendezvous_propose") {
        const target = this.findGuestSocket(parsed.targetGuestId);
        if (
          !target
          || target.attachment.guest.zoneId !== current.guest.zoneId
          || parsed.zoneId !== current.guest.zoneId
        ) return;
        const point = clampMovePosition(parsed.zoneId, parsed.x, parsed.y);
        target.socket.send(encode({
          type: "companion_rendezvous_proposed",
          guestId: current.guest.guestId,
          guestNickname: current.guest.nickname,
          proposalId: parsed.proposalId,
          zoneId: parsed.zoneId,
          x: point.x,
          y: point.y,
          expiresAt: now + companionRendezvousProposalLifetimeMs
        }));
        return;
      }

      if (parsed.type === "companion_rendezvous_reply") {
        const requester = this.findGuestSocket(parsed.requesterGuestId);
        if (!requester || requester.attachment.guest.zoneId !== current.guest.zoneId) return;
        requester.socket.send(encode({
          type: "companion_rendezvous_replied",
          guestId: current.guest.guestId,
          guestNickname: current.guest.nickname,
          proposalId: parsed.proposalId,
          accepted: parsed.accepted,
          zoneId: current.guest.zoneId
        }));
        return;
      }

      if (parsed.type === "companion_rendezvous_cancel") {
        const target = this.findGuestSocket(parsed.targetGuestId);
        if (!target) return;
        target.socket.send(encode({
          type: "companion_rendezvous_canceled",
          guestId: current.guest.guestId,
          proposalId: parsed.proposalId
        }));
        return;
      }

      if (parsed.type === "companion_portal_ready") {
        const target = this.findGuestSocket(parsed.targetGuestId);
        if (!target) return;
        target.socket.send(encode({
          type: "companion_portal_ready",
          guestId: current.guest.guestId,
          portalId: parsed.portalId,
          destinationZoneId: parsed.destinationZoneId
        }));
        return;
      }

      const target = this.findGuestSocket(parsed.targetGuestId);
      target?.socket.send(encode({ type: "companion_stopped", guestId: current.guest.guestId }));
      return;
    }

    if (parsed.type === "react") {
      const now = Date.now();
      if (now - current.lastReactionAt < reactionThrottleMs) return;

      socket.serializeAttachment({
        ...current,
        guest: { ...current.guest, lastSeenAt: now },
        lastReactionAt: now
      } satisfies GuestAttachment);
      this.broadcast({
        type: "guest_reacted",
        guestId: current.guest.guestId,
        reaction: parsed.reaction,
        zoneId: current.guest.zoneId
      }, socket);
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

  private findGuestSocket(guestId: string): { socket: WebSocket; attachment: GuestAttachment } | null {
    for (const socket of this.state.getWebSockets()) {
      const attachment = readGuestAttachment(socket);
      if (attachment?.guest.guestId === guestId) return { socket, attachment };
    }
    return null;
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
