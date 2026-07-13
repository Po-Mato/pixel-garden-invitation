import { describe, expect, it } from "vitest";
import { gardenWorld, getWorldZone, type WorldZone } from "./world";
import { findTilePath } from "./pathfinding";

function testZone(blocked: WorldZone["blocked"]): WorldZone {
  const home = getWorldZone(gardenWorld, "home");
  return {
    ...home,
    bounds: { x: 0, y: 0, width: 180, height: 180 },
    cameraSafeBounds: { x: 0, y: 0, width: 180, height: 180 },
    spawn: { x: 15, y: 15 },
    blocked,
    spots: [],
    portals: [],
    decorations: [],
    paths: []
  };
}

describe("portal tile pathfinding", () => {
  it("returns cardinal tile centers without repeating the start", () => {
    expect(findTilePath(testZone([]), { x: 15, y: 15 }, { x: 105, y: 15 })).toEqual([
      { x: 45, y: 15 },
      { x: 75, y: 15 },
      { x: 105, y: 15 }
    ]);
  });

  it("routes around blocked rectangles without diagonal steps", () => {
    const route = findTilePath(
      testZone([{ x: 45, y: 0, width: 30, height: 60 }]),
      { x: 15, y: 15 },
      { x: 105, y: 15 }
    );

    expect(route).not.toBeNull();
    expect(route).not.toContainEqual({ x: 45, y: 15 });
    let previous = { x: 15, y: 15 };
    for (const point of route ?? []) {
      expect(Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y)).toBe(30);
      previous = point;
    }
  });

  it("returns null when a goal is fully sealed", () => {
    const zone = testZone([
      { x: 75, y: 0, width: 30, height: 30 },
      { x: 105, y: 30, width: 30, height: 30 },
      { x: 75, y: 60, width: 30, height: 30 },
      { x: 45, y: 30, width: 30, height: 30 }
    ]);
    expect(findTilePath(zone, { x: 15, y: 15 }, { x: 75, y: 45 })).toBeNull();
  });

  it("finds a route from every zone spawn to every portal approach", () => {
    for (const zone of gardenWorld.zones) {
      for (const portal of zone.portals) {
        expect(findTilePath(zone, zone.spawn, portal.approach), `${zone.id}/${portal.id}`).not.toBeNull();
      }
    }
  });

  it("connects every incoming spawn to every exit in its destination zone", () => {
    for (const source of gardenWorld.zones) {
      for (const incoming of source.portals) {
        const destination = getWorldZone(gardenWorld, incoming.to);
        for (const exit of destination.portals) {
          expect(
            findTilePath(destination, incoming.spawn, exit.approach),
            `${source.id}/${incoming.id} -> ${exit.id}`
          ).not.toBeNull();
        }
      }
    }
  });
});
