import { describe, expect, it } from "vitest";
import { clampNumber, parseClientMessage, sanitizeText } from "./validation";

describe("sanitizeText", () => {
  it("trims text and limits length", () => {
    expect(sanitizeText("  garden guest  ", 20)).toBe("garden guest");
    expect(sanitizeText("abcdef", 3)).toBe("abc");
  });

  it("removes control characters", () => {
    expect(sanitizeText("hi\u0000there\u001f", 20)).toBe("hithere");
  });
});

describe("clampNumber", () => {
  it("clamps to map bounds", () => {
    expect(clampNumber(-5, 0, 100)).toBe(0);
    expect(clampNumber(105, 0, 100)).toBe(100);
    expect(clampNumber(50, 0, 100)).toBe(50);
  });
});

describe("parseClientMessage", () => {
  it("accepts a valid join message", () => {
    expect(parseClientMessage({
      type: "join",
      nickname: "민지",
      avatar: "classic",
      color: "rose"
    })).toEqual({
      type: "join",
      nickname: "민지",
      avatar: "classic",
      color: "rose"
    });
  });

  it("rejects malformed messages", () => {
    expect(parseClientMessage({ type: "move", x: "bad" })).toBeNull();
    expect(parseClientMessage({ type: "unknown" })).toBeNull();
  });
});
