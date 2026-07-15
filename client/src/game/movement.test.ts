import { describe, expect, it } from "vitest";
import {
  computeNextGridPosition,
  computeNextPosition,
  directionFromVector,
  directionTowardPoint,
  snapToGrid
} from "./movement";
import { gardenWorld, getWorldZone } from "./world";

describe("movement", () => {
  const home = getWorldZone(gardenWorld, "home");

  it("snaps positions to the 30px tile grid", () => {
    expect(snapToGrid({ x: 136, y: 410 }, home)).toEqual({ x: 135, y: 405 });
    expect(snapToGrid({ x: -10, y: 900 }, home)).toEqual({ x: 45, y: 675 });
  });

  it("moves exactly one tile in a cardinal direction", () => {
    expect(computeNextGridPosition({
      current: { x: 135, y: 405 },
      direction: "right",
      world: home
    })).toEqual({ x: 165, y: 405 });

    expect(computeNextGridPosition({
      current: { x: 135, y: 405 },
      direction: "up",
      world: home
    })).toEqual({ x: 135, y: 375 });
  });

  it("keeps grid movement out of blocked tiles", () => {
    expect(computeNextGridPosition({
      current: { x: 225, y: 225 },
      direction: "left",
      world: home
    })).toEqual({ x: 225, y: 225 });
  });

  it("keeps grid movement out of the subway ticket gates", () => {
    const station = getWorldZone(gardenWorld, "subway-station");

    expect(computeNextGridPosition({
      current: { x: 345, y: 435 },
      direction: "right",
      world: station
    })).toEqual({ x: 345, y: 435 });
  });

  it("chooses a cardinal direction toward a grid target", () => {
    expect(directionTowardPoint({ x: 195, y: 525 }, { x: 195, y: 405 })).toBe("up");
    expect(directionTowardPoint({ x: 195, y: 525 }, { x: 285, y: 525 })).toBe("right");
    expect(directionTowardPoint({ x: 195, y: 525 }, { x: 195, y: 525 })).toBeNull();
  });

  it("moves toward a target with a fixed speed", () => {
    expect(computeNextPosition({
      current: { x: 210, y: 300 },
      target: { x: 240, y: 300 },
      deltaMs: 100,
      speed: 120,
      world: home
    })).toEqual({ x: 222, y: 300 });
  });

  it("stops when close to target", () => {
    expect(computeNextPosition({
      current: { x: 210, y: 300 },
      target: { x: 213, y: 300 },
      deltaMs: 100,
      speed: 120,
      world: home
    })).toEqual({ x: 213, y: 300 });
  });

  it("does not finish continuous movement outside a walkable path", () => {
    expect(computeNextPosition({
      current: { x: 135, y: 405 },
      target: { x: 45, y: 405 },
      deltaMs: 1000,
      speed: 120,
      world: home
    })).toEqual({ x: 135, y: 405 });
  });

  it("does not cross gaps between walkable paths", () => {
    const splitPaths = {
      ...home,
      paths: [
        { id: "left", kind: "floor" as const, x: 90, y: 180, width: 90, height: 60 },
        { id: "right", kind: "floor" as const, x: 240, y: 180, width: 90, height: 60 }
      ],
      blocked: []
    };

    expect(computeNextPosition({
      current: { x: 135, y: 210 },
      target: { x: 285, y: 210 },
      deltaMs: 1000,
      speed: 180,
      world: splitPaths
    })).toEqual({ x: 135, y: 210 });
  });

  it("returns a finite safe position for non-finite movement input", () => {
    expect(computeNextPosition({
      current: { x: -10, y: 900 },
      target: { x: Number.NaN, y: 100 },
      deltaMs: 100,
      speed: 120,
      world: home
    })).toEqual({ x: 30, y: 690 });

    expect(computeNextPosition({
      current: { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      target: { x: 100, y: 100 },
      deltaMs: 100,
      speed: 120,
      world: home
    })).toEqual(home.spawn);

    expect(computeNextPosition({
      current: { x: -10, y: 900 },
      target: { x: 100, y: 100 },
      deltaMs: Number.POSITIVE_INFINITY,
      speed: 120,
      world: home
    })).toEqual({ x: 30, y: 690 });

    expect(computeNextPosition({
      current: { x: -10, y: 900 },
      target: { x: 100, y: 100 },
      deltaMs: 100,
      speed: Number.NaN,
      world: home
    })).toEqual({ x: 30, y: 690 });
  });

  it("does not tunnel through blocked rectangles on large movement steps", () => {
    expect(computeNextPosition({
      current: { x: 60, y: 120 },
      target: { x: 240, y: 120 },
      deltaMs: 2000,
      speed: 100,
      world: home
    })).toEqual({ x: 60, y: 120 });
  });

  it("does not miss diagonal paths that clip a blocked rectangle between samples", () => {
    expect(computeNextPosition({
      current: { x: 60, y: 180 },
      target: { x: 210, y: 60 },
      deltaMs: 1000,
      speed: 120,
      world: home
    })).toEqual({ x: 60, y: 180 });
  });

  it("returns a direction from a joystick vector", () => {
    expect(directionFromVector({ x: 0, y: -1 })).toBe("up");
    expect(directionFromVector({ x: 2, y: 0.5 })).toBe("right");
  });
});
