import { describe, expect, it } from "vitest";
import { computeNextPosition, directionFromVector } from "./movement";
import { gardenWorld } from "./world";

describe("movement", () => {
  it("moves toward a target with a fixed speed", () => {
    expect(computeNextPosition({
      current: { x: 100, y: 100 },
      target: { x: 130, y: 100 },
      deltaMs: 100,
      speed: 120,
      world: gardenWorld
    })).toEqual({ x: 112, y: 100 });
  });

  it("stops when close to target", () => {
    expect(computeNextPosition({
      current: { x: 100, y: 100 },
      target: { x: 103, y: 100 },
      deltaMs: 100,
      speed: 120,
      world: gardenWorld
    })).toEqual({ x: 103, y: 100 });
  });

  it("returns a direction from a joystick vector", () => {
    expect(directionFromVector({ x: 0, y: -1 })).toBe("up");
    expect(directionFromVector({ x: 2, y: 0.5 })).toBe("right");
  });
});
