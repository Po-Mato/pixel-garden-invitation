import { describe, expect, it } from "vitest";
import {
  computeNextGridPosition,
  computeNextPosition,
  directionFromVector,
  directionTowardPoint,
  snapToGrid
} from "./movement";
import { gardenWorld } from "./world";

describe("movement", () => {
  it("snaps positions to the 30px tile grid", () => {
    expect(snapToGrid({ x: 196, y: 520 }, gardenWorld)).toEqual({ x: 195, y: 525 });
    expect(snapToGrid({ x: -10, y: 900 }, gardenWorld)).toEqual({ x: 15, y: 705 });
  });

  it("moves exactly one tile in a cardinal direction", () => {
    expect(computeNextGridPosition({
      current: { x: 195, y: 525 },
      direction: "right",
      world: gardenWorld
    })).toEqual({ x: 225, y: 525 });

    expect(computeNextGridPosition({
      current: { x: 195, y: 525 },
      direction: "up",
      world: gardenWorld
    })).toEqual({ x: 195, y: 495 });
  });

  it("keeps grid movement out of blocked tiles", () => {
    expect(computeNextGridPosition({
      current: { x: 135, y: 75 },
      direction: "right",
      world: gardenWorld
    })).toEqual({ x: 135, y: 75 });
  });

  it("chooses a cardinal direction toward a grid target", () => {
    expect(directionTowardPoint({ x: 195, y: 525 }, { x: 195, y: 405 })).toBe("up");
    expect(directionTowardPoint({ x: 195, y: 525 }, { x: 285, y: 525 })).toBe("right");
    expect(directionTowardPoint({ x: 195, y: 525 }, { x: 195, y: 525 })).toBeNull();
  });

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

  it("returns a finite safe position for non-finite movement input", () => {
    expect(computeNextPosition({
      current: { x: -10, y: 900 },
      target: { x: Number.NaN, y: 100 },
      deltaMs: 100,
      speed: 120,
      world: gardenWorld
    })).toEqual({ x: 0, y: 720 });

    expect(computeNextPosition({
      current: { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      target: { x: 100, y: 100 },
      deltaMs: 100,
      speed: 120,
      world: gardenWorld
    })).toEqual(gardenWorld.spawn);

    expect(computeNextPosition({
      current: { x: -10, y: 900 },
      target: { x: 100, y: 100 },
      deltaMs: Number.POSITIVE_INFINITY,
      speed: 120,
      world: gardenWorld
    })).toEqual({ x: 0, y: 720 });

    expect(computeNextPosition({
      current: { x: -10, y: 900 },
      target: { x: 100, y: 100 },
      deltaMs: 100,
      speed: Number.NaN,
      world: gardenWorld
    })).toEqual({ x: 0, y: 720 });
  });

  it("does not tunnel through blocked rectangles on large movement steps", () => {
    expect(computeNextPosition({
      current: { x: 120, y: 96 },
      target: { x: 260, y: 96 },
      deltaMs: 2000,
      speed: 100,
      world: gardenWorld
    })).toEqual({ x: 120, y: 96 });
  });

  it("does not miss diagonal paths that clip a blocked rectangle between samples", () => {
    expect(computeNextPosition({
      current: { x: 130, y: 68.5 },
      target: { x: 190.5, y: 8 },
      deltaMs: 1000,
      speed: 120,
      world: gardenWorld
    })).toEqual({ x: 130, y: 68.5 });
  });

  it("returns a direction from a joystick vector", () => {
    expect(directionFromVector({ x: 0, y: -1 })).toBe("up");
    expect(directionFromVector({ x: 2, y: 0.5 })).toBe("right");
  });
});
