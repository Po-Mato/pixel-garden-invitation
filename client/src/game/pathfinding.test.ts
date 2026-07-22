import { describe, expect, it } from "vitest";
import { isBlocked } from "./geometry";
import { gardenWorld, getWorldZone, type WorldZone } from "./world";
import { findNearestInteractionRoute, findNearestPortalRoute, findTilePath } from "./pathfinding";

function testZone(
  blocked: WorldZone["blocked"],
  paths: WorldZone["paths"] = [{ id: "test-path", kind: "floor", x: 0, y: 0, width: 180, height: 180 }]
): WorldZone {
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
    paths
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

  it("returns null when the start or goal is blocked", () => {
    expect(findTilePath(testZone([{ x: 0, y: 0, width: 30, height: 30 }]), { x: 15, y: 15 }, { x: 105, y: 15 })).toBeNull();
    expect(findTilePath(testZone([{ x: 90, y: 0, width: 30, height: 30 }]), { x: 15, y: 15 }, { x: 105, y: 15 })).toBeNull();
  });

  it("returns null when the start or goal lies outside a path", () => {
    const paths = [{ id: "test-path", kind: "floor" as const, x: 0, y: 0, width: 90, height: 30 }];
    expect(findTilePath(testZone([], paths), { x: 15, y: 15 }, { x: 105, y: 15 })).toBeNull();
  });

  it("selects the shortest reachable entry tile for a clicked portal", () => {
    const home = getWorldZone(gardenWorld, "home");
    const portal = home.portals[0];
    const route = findNearestPortalRoute(home, { x: 255, y: 165 }, portal);

    expect(route).not.toBeNull();
    expect(route?.entry).toEqual({ x: 255, y: 105 });
    expect(route?.path.at(-1)).toEqual(route?.entry);
  });

  it("returns an empty path when already standing on an entry tile", () => {
    const home = getWorldZone(gardenWorld, "home");
    const portal = home.portals[0];
    const route = findNearestPortalRoute(home, portal.entryTiles[2], portal);

    expect(route).toEqual({ entry: portal.entryTiles[2], path: [] });
  });

  it("returns null when all three portal entry tiles are blocked", () => {
    const home = getWorldZone(gardenWorld, "home");
    const portal = home.portals[0];
    const sealedHome = {
      ...home,
      blocked: [
        ...home.blocked,
        ...portal.entryTiles.map((tile) => ({
          x: tile.x - 15,
          y: tile.y - 15,
          width: 30,
          height: 30
        }))
      ]
    };

    expect(findNearestPortalRoute(sealedHome, home.spawn, portal)).toBeNull();
  });

  it("finds a route from every zone spawn to every portal entry tile", () => {
    for (const zone of gardenWorld.zones) {
      for (const portal of zone.portals) {
        for (const entry of portal.entryTiles) {
          const route = findTilePath(zone, zone.spawn, entry);
          expect(route, `${zone.id}/${portal.id}/${entry.x},${entry.y}`).not.toBeNull();
          for (const point of route ?? []) {
            expect(isBlocked(point, zone), `${zone.id}/${portal.id} (${point.x}, ${point.y})`).toBe(false);
          }
        }
      }
    }
  });

  it("uses a direct route across the open subway platform", () => {
    const station = getWorldZone(gardenWorld, "subway-station");
    const eastPortal = station.portals.find((portal) => portal.id === "station-to-train");
    const route = findTilePath(station, station.spawn, eastPortal!.approach);

    expect(route).not.toBeNull();
    expect(route?.at(-1)).toEqual(eastPortal?.approach);
    expect(route?.every((point) => point.y === station.spawn.y)).toBe(true);
    for (const point of route ?? []) {
      expect(isBlocked(point, station)).toBe(false);
    }
  });

  it("uses the venue plaza side path to bypass the fountain", () => {
    const venue = getWorldZone(gardenWorld, "venue-exterior");
    const route = findTilePath(venue, { x: 285, y: 615 }, { x: 285, y: 405 });

    expect(route).not.toBeNull();
    expect(route?.at(-1)).toEqual({ x: 285, y: 405 });
    expect(route?.some((point) => point.x === 375)).toBe(true);
    for (const point of route ?? []) {
      expect(isBlocked(point, venue), `venue-exterior (${point.x}, ${point.y})`).toBe(false);
    }
  });

  it("connects the Task 10 lobby spawn to all four portal approaches", () => {
    const lobby = getWorldZone(gardenWorld, "lobby");

    expect(lobby.spawn).toEqual({ x: 525, y: 765 });
    expect(lobby.portals.map((portal) => portal.id)).toEqual([
      "lobby-to-venue",
      "lobby-to-bridal",
      "lobby-to-banquet",
      "lobby-to-hall"
    ]);
    for (const portal of lobby.portals) {
      const route = findTilePath(lobby, lobby.spawn, portal.approach);
      expect(route, portal.id).not.toBeNull();
      expect(route?.at(-1), portal.id).toEqual(portal.approach);
    }
  });

  it("connects the Task 11 bridal spawn to the lobby portal, couple greeting tile, and bride greeting tile", () => {
    const bridal = getWorldZone(gardenWorld, "bridal-room");
    const goals = [
      bridal.portals.find((portal) => portal.id === "bridal-to-lobby")!.approach,
      { x: 165, y: 255 },
      { x: 345, y: 285 }
    ];

    expect(bridal.spawn).toEqual({ x: 345, y: 525 });
    for (const goal of goals) {
      const route = findTilePath(bridal, bridal.spawn, goal);
      expect(route, `bridal-room ${goal.x},${goal.y}`).not.toBeNull();
      expect(route?.at(-1), `bridal-room ${goal.x},${goal.y}`).toEqual(goal);
      for (const point of route ?? []) {
        expect(isBlocked(point, bridal), `bridal-room (${point.x},${point.y})`).toBe(false);
      }
    }
  });

  it("connects the ceremony hall entrance to the couple greeting tile", () => {
    const hall = getWorldZone(gardenWorld, "ceremony-hall");
    const lobbyPortal = hall.portals.find((portal) => portal.id === "hall-to-lobby");
    const goals = [
      lobbyPortal!.approach,
      { x: 285, y: 165 }
    ];

    expect(hall.spawn).toEqual({ x: 375, y: 1785 });
    for (const goal of goals) {
      const route = findTilePath(hall, hall.spawn, goal);
      expect(route, `ceremony-hall ${goal.x},${goal.y}`).not.toBeNull();
      expect(route?.at(-1), `ceremony-hall ${goal.x},${goal.y}`).toEqual(goal);
      for (const point of route ?? []) {
        expect(isBlocked(point, hall), `ceremony-hall (${point.x},${point.y})`).toBe(false);
      }
    }
  });

  it("connects both banquet entrances to both exits and the guestbook tile", () => {
    const banquet = getWorldZone(gardenWorld, "banquet");
    const starts = [{ x: 135, y: 465 }, { x: 1065, y: 465 }];
    const goals = [...banquet.portals.map((portal) => portal.approach), { x: 975, y: 735 }];

    for (const start of starts) {
      for (const goal of goals) {
        const route = findTilePath(banquet, start, goal);
        expect(route, `banquet ${start.x},${start.y} -> ${goal.x},${goal.y}`).not.toBeNull();
        expect(route?.at(-1)).toEqual(goal);
        for (const point of route ?? []) {
          expect(isBlocked(point, banquet), `banquet (${point.x},${point.y})`).toBe(false);
        }
      }
    }
  });

  it("connects the restroom spawn to the banquet portal through the narrow entry", () => {
    const restroom = getWorldZone(gardenWorld, "restroom");
    const banquetPortal = restroom.portals.find((portal) => portal.id === "restroom-to-banquet");

    expect(restroom.spawn).toEqual({ x: 135, y: 345 });
    expect(banquetPortal?.approach).toEqual({ x: 105, y: 345 });

    const route = banquetPortal ? findTilePath(restroom, restroom.spawn, banquetPortal.approach) : null;
    expect(route).not.toBeNull();
    expect(route?.at(-1)).toEqual(banquetPortal?.approach);
    for (const point of route ?? []) {
      expect(isBlocked(point, restroom), `restroom (${point.x},${point.y})`).toBe(false);
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

  it("finds the shortest reachable tile beside an interaction target", () => {
    const zone = testZone([{ x: 60, y: 60, width: 60, height: 60 }]);
    const route = findNearestInteractionRoute(
      zone,
      { x: 15, y: 15 },
      { x: 60, y: 60, width: 60, height: 60 },
      45
    );

    expect(route).not.toBeNull();
    expect(route?.path.at(-1)).toEqual(route?.entry);
    expect(route?.entry).toEqual({ x: 45, y: 15 });
    expect(isBlocked(route!.entry, zone)).toBe(false);
  });

  it("returns an empty interaction path when already close enough", () => {
    const home = getWorldZone(gardenWorld, "home");
    const directions = home.spots[0];
    const start = { x: 225, y: 285 };

    expect(findNearestInteractionRoute(home, start, directions, directions.actionRadius)).toEqual({
      entry: start,
      path: []
    });
  });

  it("reaches every world content spot from its zone spawn", () => {
    for (const zone of gardenWorld.zones) {
      for (const worldSpot of zone.spots) {
        const route = findNearestInteractionRoute(zone, zone.spawn, worldSpot, worldSpot.actionRadius);

        expect(route, `${zone.id}/${worldSpot.id}`).not.toBeNull();
        expect(isBlocked(route!.entry, zone), `${zone.id}/${worldSpot.id}`).toBe(false);
      }
    }
  });

  it("approaches an NPC without stepping onto its occupied area", () => {
    const bridal = getWorldZone(gardenWorld, "bridal-room");
    const bride = bridal.npcs[0];
    const target = { x: bride.x - 30, y: bride.y - 45, width: 60, height: 75 };
    const route = findNearestInteractionRoute(bridal, bridal.spawn, target, 30);

    expect(route).not.toBeNull();
    expect(route?.path.at(-1)).toEqual(route?.entry);
    expect(route?.entry).toEqual({ x: 345, y: 345 });
    expect(isBlocked(route!.entry, { ...bridal, blocked: [...bridal.blocked, target] })).toBe(false);
  });
});
