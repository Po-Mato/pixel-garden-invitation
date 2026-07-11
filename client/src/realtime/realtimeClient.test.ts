import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultCharacterAppearance, type WorldZoneId } from "@wedding-game/shared";
import { connectRealtime, connectRealtimeWithRetry, createMoveThrottle, getRoomUrl } from "./realtimeClient";

type MockListener = (event: Event) => void;

class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];

  readonly sentMessages: string[] = [];
  readonly listeners = new Map<string, MockListener[]>();
  readyState = MockWebSocket.OPEN;
  closed = false;

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
    this.closed = true;
    this.emit("close");
  }

  emit(type: string, event: Event = new Event(type)) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

const joinMessage = {
  type: "join",
  nickname: "하객1",
  appearance: defaultCharacterAppearance,
  zoneId: "ceremony"
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
    throttle({ type: "move", x: 1, y: 1, direction: "down", moving: true, seq: 1, zoneId: "ceremony" }, 0);
    throttle({ type: "move", x: 2, y: 2, direction: "down", moving: true, seq: 2, zoneId: "ceremony" }, 50);
    throttle({ type: "move", x: 3, y: 3, direction: "down", moving: true, seq: 3, zoneId: "ceremony" }, 100);
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

  it("normalizes room guests with invalid appearances to the default preset", () => {
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
            zoneId: "gallery",
            lastSeenAt: 1000
          }]
        })
      })
    );

    expect(onMessage).toHaveBeenCalledWith({
      type: "welcome",
      guestId: "guest_self",
      guests: [expect.objectContaining({
        guestId: "guest_remote",
        appearance: defaultCharacterAppearance,
        zoneId: "gallery"
      })]
    });
  });

  it("rejects server guests from unknown zones", () => {
    const onMessage = vi.fn();
    connectRealtime("wss://worker.example.com/rooms/sample-garden", joinMessage, {
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onMessage
    });

    MockWebSocket.instances[0].emit(
      "message",
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "welcome",
          guestId: "guest_self",
          guests: [{
            guestId: "guest_remote",
            nickname: "하객2",
            appearance: defaultCharacterAppearance,
            x: 39,
            y: 72,
            direction: "down",
            moving: false,
            seq: 0,
            zoneId: "rooftop",
            lastSeenAt: 1000
          }]
        })
      })
    );

    expect(onMessage).toHaveBeenCalledWith({ type: "error", code: "bad_message" });
  });
});

describe("connectRealtimeWithRetry", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries failures with bounded exponential backoff", () => {
    const connection = connectRealtimeWithRetry(
      "wss://worker.example.com/rooms/sample-garden",
      () => joinMessage,
      { onOpen: vi.fn(), onClose: vi.fn(), onMessage: vi.fn() }
    );

    expect(MockWebSocket.instances).toHaveLength(1);
    MockWebSocket.instances[0].emit("error");

    vi.advanceTimersByTime(499);
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(2);

    MockWebSocket.instances[1].emit("error");
    vi.advanceTimersByTime(999);
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(3);

    MockWebSocket.instances[2].emit("error");
    vi.advanceTimersByTime(2000);
    expect(MockWebSocket.instances).toHaveLength(4);

    connection.close();
  });

  it("resets the retry delay after a connection opens", () => {
    const connection = connectRealtimeWithRetry(
      "wss://worker.example.com/rooms/sample-garden",
      () => joinMessage,
      { onOpen: vi.fn(), onClose: vi.fn(), onMessage: vi.fn() }
    );

    MockWebSocket.instances[0].emit("error");
    vi.advanceTimersByTime(500);
    MockWebSocket.instances[1].emit("open");
    MockWebSocket.instances[1].emit("error");

    vi.advanceTimersByTime(499);
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(3);

    connection.close();
  });

  it("reads the latest join state for every reconnect attempt", () => {
    let zoneId: WorldZoneId = joinMessage.zoneId;
    const connection = connectRealtimeWithRetry(
      "wss://worker.example.com/rooms/sample-garden",
      () => ({ ...joinMessage, zoneId }),
      { onOpen: vi.fn(), onClose: vi.fn(), onMessage: vi.fn() }
    );

    MockWebSocket.instances[0].emit("error");
    zoneId = "lounge";
    vi.advanceTimersByTime(500);
    MockWebSocket.instances[1].emit("open");

    expect(JSON.parse(MockWebSocket.instances[1].sentMessages[0])).toMatchObject({ zoneId: "lounge" });

    connection.close();
  });

  it("does not retry after an intentional close", () => {
    const connection = connectRealtimeWithRetry(
      "wss://worker.example.com/rooms/sample-garden",
      () => joinMessage,
      { onOpen: vi.fn(), onClose: vi.fn(), onMessage: vi.fn() }
    );

    connection.close();
    vi.advanceTimersByTime(30_000);

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("stops retrying after the room reports that it is full", () => {
    const onMessage = vi.fn();
    connectRealtimeWithRetry(
      "wss://worker.example.com/rooms/sample-garden",
      () => joinMessage,
      { onOpen: vi.fn(), onClose: vi.fn(), onMessage }
    );
    const socket = MockWebSocket.instances[0];

    socket.emit(
      "message",
      new MessageEvent("message", {
        data: JSON.stringify({ type: "error", code: "room_full" })
      })
    );
    vi.advanceTimersByTime(30_000);

    expect(onMessage).toHaveBeenCalledWith({ type: "error", code: "room_full" });
    expect(socket.closed).toBe(true);
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
