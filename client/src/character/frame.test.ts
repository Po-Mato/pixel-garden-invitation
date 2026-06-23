import { describe, expect, it } from "vitest";
import { getWalkFrameStyle } from "./frame";

describe("getWalkFrameStyle", () => {
  it("maps direction and step to exact 48x72 sheet offsets", () => {
    expect(getWalkFrameStyle("down", 0)).toEqual({ x: 0, y: 0 });
    expect(getWalkFrameStyle("left", 1)).toEqual({ x: -48, y: -72 });
    expect(getWalkFrameStyle("right", 2)).toEqual({ x: -96, y: -144 });
    expect(getWalkFrameStyle("up", 1)).toEqual({ x: -48, y: -216 });
  });

  it("normalizes arbitrary step values", () => {
    expect(getWalkFrameStyle("down", 4)).toEqual({ x: -48, y: 0 });
  });

  it("maps offsets with a custom high-density frame size", () => {
    expect(getWalkFrameStyle("left", 1, { width: 96, height: 144 })).toEqual({ x: -96, y: -144 });
    expect(getWalkFrameStyle("right", 2, { width: 96, height: 144 })).toEqual({ x: -192, y: -288 });
  });
});
