import { describe, expect, it, vi } from "vitest";
import { createMoveThrottle, getRoomUrl } from "./realtimeClient";

describe("getRoomUrl", () => {
  it("builds a worker websocket URL", () => {
    expect(getRoomUrl("https://worker.example.com", "sample-garden")).toBe("wss://worker.example.com/rooms/sample-garden");
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
