import { describe, expect, it } from "vitest";
import { getNearbySpot, isBlocked, clampToWorld } from "./geometry";
import { gardenWorld } from "./world";

describe("world geometry", () => {
  it("clamps the player inside the world", () => {
    expect(clampToWorld({ x: -10, y: 900 }, gardenWorld.bounds)).toEqual({ x: 0, y: 720 });
  });

  it("detects blocked booth rectangles", () => {
    expect(isBlocked({ x: 180, y: 96 }, gardenWorld)).toBe(true);
    expect(isBlocked({ x: 210, y: 340 }, gardenWorld)).toBe(false);
  });

  it("finds the nearest actionable spot", () => {
    expect(getNearbySpot({ x: 200, y: 114 }, gardenWorld)?.id).toBe("wedding-info");
    expect(getNearbySpot({ x: 210, y: 340 }, gardenWorld)).toBeNull();
  });
});
