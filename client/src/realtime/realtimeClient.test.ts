import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { connectRealtime, createMoveThrottle, getRoomUrl } from "./realtimeClient";

type MockListener = (event: Event) => void;

class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];

  readonly sentMessages: string[] = [];
  readonly listeners = new Map<string, MockListener[]>();
  readyState = MockWebSocket.OPEN;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: MockListener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(message: string) {
    this.sentMessages.push(message);
  }

  close() {
    this.emit("close");
  }

  emit(type: string, event: Event = new Event(type)) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

const joinMessage = {
  type: "join",
  nickname: "하객1",
  appearance: defaultCharacterAppearance
} as const;

describe("getRoomUrl", () => {
  it("builds a worker websocket URL", () => {
    expect(getRoomUrl("https://worker.example.com", "sample-garden")).toBe("wss://worker.example.com/rooms/sample-garden");
  });

  it("preserves websocket worker URL schemes", () => {
    expect(getRoomUrl("wss://worker.example.com/base", "sample-garden")).toBe("wss://worker.example.com/rooms/sample-garden");
    expect(getRoomUrl("ws://worker.example.com/base", "sample-garden")).toBe("ws://worker.example.com/rooms/sample-garden");
  });

  it("encodes room ids and clears worker URL query and hash", () => {
    expect(getRoomUrl("https://worker.example.com/base?token=abc#fragment", "garden/../a b?x#y")).toBe(
      "wss://worker.example.com/rooms/garden%2F..%2Fa%20b%3Fx%23y"
    );
  });

  it("rejects unsupported worker URL schemes", () => {
    expect(() => getRoomUrl("ftp://worker.example.com", "sample-garden")).toThrow("Unsupported realtime worker URL scheme");
  });
});

describe("createMoveThrottle", () => {
  it("limits movement messages to 10fps", () => {
    const send = vi.fn();
    const throttle = createMoveThrottle(send, 100);
    throttle({ type: "move", x: 1, y: 1, direction: "down", moving: true, seq: 1 }, 0);
    throttle({ type: "move", x: 2, y: 2, direction: "down", moving: true, seq: 2 }, 50);
    throttle({ type: "move", x: 3, y: 3, direction: "down", moving: true, seq: 3 }, 100);
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe("connectRealtime", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("notifies close handlers once when error and close both fire", () => {
    const onClose = vi.fn();
    connectRealtime("wss://worker.example.com/rooms/sample-garden", joinMessage, {
      onOpen: vi.fn(),
      onClose,
      onMessage: vi.fn()
    });

    const socket = MockWebSocket.instances[0];
    socket.emit("error");
    socket.emit("close");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports bad_message for invalid server payloads", () => {
    const onMessage = vi.fn();
    connectRealtime("wss://worker.example.com/rooms/sample-garden", joinMessage, {
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onMessage
    });

    const socket = MockWebSocket.instances[0];
    socket.emit(
      "message",
      new MessageEvent("message", {
        data: JSON.stringify({ type: "welcome", guestId: 123, guests: [] })
      })
    );

    expect(onMessage).toHaveBeenCalledWith({ type: "error", code: "bad_message" });
  });

  it("rejects room guests with invalid appearances", () => {
    const onMessage = vi.fn();
    connectRealtime("wss://worker.example.com/rooms/sample-garden", joinMessage, {
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onMessage
    });

    const socket = MockWebSocket.instances[0];
    socket.emit(
      "message",
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "welcome",
          guestId: "guest_self",
          guests: [{
            guestId: "guest_remote",
            nickname: "하객2",
            appearance: { family: "bad" },
            x: 39,
            y: 72,
            direction: "down",
            moving: false,
            seq: 0,
            lastSeenAt: 1000
          }]
        })
      })
    );

    expect(onMessage).toHaveBeenCalledWith({ type: "error", code: "bad_message" });
  });
});
