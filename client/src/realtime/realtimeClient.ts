import type { ClientMessage, ServerMessage } from "@wedding-game/shared";

type MoveMessage = Extract<ClientMessage, { type: "move" }>;
type JoinMessage = Extract<ClientMessage, { type: "join" }>;

export type RealtimeHandlers = {
  onOpen: () => void;
  onClose: () => void;
  onMessage: (message: ServerMessage) => void;
};

export function getRoomUrl(workerUrl: string, invitationId: string) {
  const url = new URL(workerUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/rooms/${invitationId}`;
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

export function connectRealtime(url: string, join: JoinMessage, handlers: RealtimeHandlers) {
  const socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    handlers.onOpen();
    socket.send(JSON.stringify(join));
  });

  socket.addEventListener("close", () => {
    handlers.onClose();
  });

  socket.addEventListener("error", () => {
    handlers.onClose();
  });

  socket.addEventListener("message", (event) => {
    try {
      handlers.onMessage(JSON.parse(event.data) as ServerMessage);
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
