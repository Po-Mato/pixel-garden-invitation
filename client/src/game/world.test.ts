import { describe, expect, it } from "vitest";
import { worldZoneIds } from "@wedding-game/shared";
import { isBlocked, isWalkable, pointInRect } from "./geometry";
import { gridTileSize } from "./movement";
import { findTilePath } from "./pathfinding";
import { gardenWorld, getWorldZone } from "./world";

const expectedSizes = {
  home: [600, 720],
  neighborhood: [1200, 660],
  "subway-station": [900, 840],
  "subway-train": [1440, 540],
  "venue-exterior": [840, 900],
  lobby: [960, 780],
  "bridal-room": [600, 540],
  "ceremony-hall": [660, 1800],
  restroom: [540, 600],
  banquet: [1080, 840]
} as const;

function isTileCenter(value: number, origin: number): boolean {
  return (value - origin - gridTileSize / 2) % gridTileSize === 0;
}

describe("guest route world", () => {
  it("defines the exact ten-zone journey with varied dimensions", () => {
    expect(gardenWorld.defaultZoneId).toBe("home");
    expect(gardenWorld.zones.map((zone) => zone.id)).toEqual(worldZoneIds);

    for (const [zoneId, [width, height]] of Object.entries(expectedSizes)) {
      const zone = getWorldZone(gardenWorld, zoneId as keyof typeof expectedSizes);
      expect([zone.bounds.width, zone.bounds.height]).toEqual([width, height]);
    }

    expect(new Set(gardenWorld.zones.map((zone) => `${zone.bounds.width}x${zone.bounds.height}`)).size).toBe(10);
  });

  it("connects the full route and lobby branches with reverse portals", () => {
    const requiredEdges = [
      ["home", "neighborhood"],
      ["neighborhood", "subway-station"],
      ["subway-station", "subway-train"],
      ["subway-train", "venue-exterior"],
      ["venue-exterior", "lobby"],
      ["lobby", "bridal-room"],
      ["lobby", "restroom"],
      ["lobby", "ceremony-hall"],
      ["ceremony-hall", "banquet"]
    ] as const;

    for (const [from, to] of requiredEdges) {
      expect(getWorldZone(gardenWorld, from).portals.some((portal) => portal.to === to)).toBe(true);
      expect(getWorldZone(gardenWorld, to).portals.some((portal) => portal.to === from)).toBe(true);
    }
  });

  it("defines the v2 home layout, portal, and topiary depth asset", () => {
    const home = getWorldZone(gardenWorld, "home");

    expect(home.spawn).toEqual({ x: 285, y: 555 });
    expect(home.paths).toEqual([
      { id: "home-floor", kind: "floor", x: 90, y: 120, width: 420, height: 510 },
      { id: "home-entry", kind: "floor", x: 240, y: 60, width: 120, height: 120 }
    ]);
    expect(home.spots).toEqual([
      expect.objectContaining({ id: "directions", x: 90, y: 180, width: 120, height: 90 })
    ]);
    const [directionsSpot] = home.spots;
    expect(home.blocked).toEqual([
      { x: 360, y: 240, width: 150, height: 90 },
      { x: 270, y: 330, width: 120, height: 90 },
      { x: 90, y: 480, width: 120, height: 120 },
      { x: 420, y: 480, width: 60, height: 90 },
      directionsSpot
    ]);

    expect(home.portals).toEqual([
      expect.objectContaining({
        id: "home-to-neighborhood",
        to: "neighborhood",
        x: 240,
        y: 30,
        width: 120,
        height: 90,
        approach: { x: 285, y: 105 },
        facing: "up",
        spawn: { x: 135, y: 375 }
      })
    ]);
    expect(home.decorations).toContainEqual(expect.objectContaining({
      id: "home-plant",
      kind: "topiary",
      x: 420,
      y: 480,
      width: 60,
      height: 90,
      asset: "topiary-foreground.png",
      depthY: 555
    }));
  });

  it("defines the v2 neighborhood street, portals, and tree canopy assets", () => {
    const neighborhood = getWorldZone(gardenWorld, "neighborhood");

    expect(neighborhood.spawn).toEqual({ x: 135, y: 375 });
    expect(neighborhood.paths).toEqual([
      { id: "neighborhood-street", kind: "street", x: 60, y: 240, width: 1080, height: 270 },
      { id: "neighborhood-crosswalk", kind: "crosswalk", x: 510, y: 180, width: 180, height: 390 }
    ]);
    expect(neighborhood.portals).toEqual([
      expect.objectContaining({
        id: "neighborhood-to-home",
        to: "home",
        x: 30,
        y: 315,
        width: 90,
        height: 120,
        approach: { x: 105, y: 375 },
        facing: "left",
        spawn: { x: 285, y: 135 }
      }),
      expect.objectContaining({
        id: "neighborhood-to-station",
        to: "subway-station",
        x: 1080,
        y: 300,
        width: 90,
        height: 150,
        approach: { x: 1095, y: 375 },
        facing: "right",
        spawn: { x: 135, y: 435 }
      })
    ]);
    expect(neighborhood.decorations.filter((item) => item.kind === "tree")).toEqual([
      expect.objectContaining({ x: 214, y: 120, width: 90, height: 150, asset: "tree-canopy.png", depthY: 270 }),
      expect.objectContaining({ x: 513, y: 90, width: 90, height: 150, asset: "tree-canopy.png", depthY: 240 }),
      expect.objectContaining({ x: 860, y: 120, width: 90, height: 150, asset: "tree-canopy.png", depthY: 270 })
    ]);
  });

  it("routes safely from the neighborhood spawn to both portal approaches", () => {
    const neighborhood = getWorldZone(gardenWorld, "neighborhood");

    for (const portal of neighborhood.portals) {
      const route = findTilePath(neighborhood, neighborhood.spawn, portal.approach);
      expect(route, portal.id).not.toBeNull();
      expect(route?.at(-1), portal.id).toEqual(portal.approach);
    }
  });

  it("keeps the home return spawn safe after the neighborhood portal transition", () => {
    const home = getWorldZone(gardenWorld, "home");
    const returnHome = getWorldZone(gardenWorld, "neighborhood").portals.find((portal) => portal.to === "home");

    expect(returnHome?.spawn).toEqual({ x: 285, y: 135 });
    expect(returnHome?.spawn).not.toEqual(home.portals[0].approach);
    expect(returnHome && pointInRect(returnHome.spawn, home.cameraSafeBounds)).toBe(true);
    expect(returnHome && isBlocked(returnHome.spawn, home)).toBe(false);
  });

  it("keeps the station return spawn safe and walkable in the neighborhood", () => {
    const neighborhood = getWorldZone(gardenWorld, "neighborhood");
    const returnNeighborhood = getWorldZone(gardenWorld, "subway-station").portals.find(
      (portal) => portal.id === "station-to-neighborhood"
    );

    expect(returnNeighborhood?.spawn).toEqual({ x: 1065, y: 375 });
    expect(returnNeighborhood && pointInRect(returnNeighborhood.spawn, neighborhood.cameraSafeBounds)).toBe(true);
    expect(returnNeighborhood && isWalkable(returnNeighborhood.spawn, neighborhood)).toBe(true);
    expect(returnNeighborhood && isBlocked(returnNeighborhood.spawn, neighborhood)).toBe(false);
  });

  it("defines the v2 subway station layout, portals, and gate-front overlays", () => {
    const station = getWorldZone(gardenWorld, "subway-station");
    const [directionsSpot] = station.spots;

    expect(station.spawn).toEqual({ x: 135, y: 435 });
    expect(station.paths).toEqual([
      { id: "station-concourse", kind: "floor", x: 60, y: 300, width: 600, height: 270 },
      { id: "station-gate-corridor", kind: "corridor", x: 330, y: 240, width: 240, height: 390 },
      { id: "station-platform", kind: "platform", x: 600, y: 120, width: 210, height: 600 }
    ]);
    expect(station.spots).toEqual([
      expect.objectContaining({ id: "directions", x: 120, y: 150, width: 120, height: 90 })
    ]);
    expect(station.blocked).toEqual([
      { x: 360, y: 360, width: 60, height: 120 },
      { x: 450, y: 360, width: 60, height: 120 },
      { x: 540, y: 360, width: 60, height: 120 },
      directionsSpot
    ]);
    expect(station.portals).toEqual([
      expect.objectContaining({
        id: "station-to-neighborhood",
        to: "neighborhood",
        x: 30,
        y: 375,
        width: 90,
        height: 120,
        approach: { x: 105, y: 435 },
        facing: "left",
        spawn: { x: 1065, y: 375 }
      }),
      expect.objectContaining({
        id: "station-to-train",
        to: "subway-train",
        x: 750,
        y: 360,
        width: 90,
        height: 150,
        approach: { x: 735, y: 435 },
        facing: "right",
        spawn: { x: 135, y: 285 }
      })
    ]);
    expect(station.decorations.filter((item) => item.kind === "ticket-gate")).toEqual([
      expect.objectContaining({ id: "station-gate-1", x: 360, y: 360, width: 60, height: 120, asset: "ticket-gate-front.png", depthY: 480 }),
      expect.objectContaining({ id: "station-gate-2", x: 450, y: 360, width: 60, height: 120, asset: "ticket-gate-front.png", depthY: 480 }),
      expect.objectContaining({ id: "station-gate-3", x: 540, y: 360, width: 60, height: 120, asset: "ticket-gate-front.png", depthY: 480 })
    ]);
  });

  it("keeps the station portal spawns safe in both destination zones", () => {
    const station = getWorldZone(gardenWorld, "subway-station");
    const neighborhood = getWorldZone(gardenWorld, "neighborhood");
    const train = getWorldZone(gardenWorld, "subway-train");

    for (const portalItem of station.portals) {
      const destination = portalItem.to === "neighborhood" ? neighborhood : train;
      expect(pointInRect(portalItem.spawn, destination.cameraSafeBounds), portalItem.id).toBe(true);
      expect(isWalkable(portalItem.spawn, destination), portalItem.id).toBe(true);
      expect(isBlocked(portalItem.spawn, destination), portalItem.id).toBe(false);
    }
  });

  it("returns from the train beside the station east portal on a safe platform tile", () => {
    const station = getWorldZone(gardenWorld, "subway-station");
    const train = getWorldZone(gardenWorld, "subway-train");
    const platform = station.paths.find((worldPath) => worldPath.id === "station-platform");
    const returnStation = train.portals.find((portalItem) => portalItem.id === "train-to-station");

    expect(returnStation?.spawn).toEqual({ x: 705, y: 435 });
    expect(platform && returnStation && pointInRect(returnStation.spawn, platform)).toBe(true);
    expect(returnStation && pointInRect(returnStation.spawn, station.cameraSafeBounds)).toBe(true);
    expect(returnStation && isWalkable(returnStation.spawn, station)).toBe(true);
    expect(returnStation && isBlocked(returnStation.spawn, station)).toBe(false);
  });

  it("defines the v2 subway train carriage, portals, and strap foreground overlay", () => {
    const train = getWorldZone(gardenWorld, "subway-train");

    expect(train.spawn).toEqual({ x: 135, y: 285 });
    expect(train.paths).toEqual([
      { id: "train-carriage", kind: "carriage", x: 60, y: 180, width: 1320, height: 210 }
    ]);
    expect(train.portals).toEqual([
      expect.objectContaining({
        id: "train-to-station",
        to: "subway-station",
        x: 30,
        y: 210,
        width: 90,
        height: 150,
        approach: { x: 105, y: 285 },
        facing: "left",
        spawn: { x: 705, y: 435 }
      }),
      expect.objectContaining({
        id: "train-to-venue",
        to: "venue-exterior",
        x: 1320,
        y: 210,
        width: 90,
        height: 150,
        approach: { x: 1335, y: 285 },
        facing: "right",
        spawn: { x: 465, y: 765 }
      })
    ]);
    expect(train.decorations).toContainEqual(expect.objectContaining({
      id: "train-straps",
      kind: "string-lights",
      x: 240,
      y: 105,
      width: 960,
      height: 120,
      asset: "strap-row-foreground.png",
      depthY: 420
    }));
  });

  it("routes across the wide train carriage to both portal approaches", () => {
    const train = getWorldZone(gardenWorld, "subway-train");

    for (const portalItem of train.portals) {
      const route = findTilePath(train, train.spawn, portalItem.approach);
      expect(route, portalItem.id).not.toBeNull();
      expect(route?.at(-1), portalItem.id).toEqual(portalItem.approach);
    }
  });

  it("finds the lower bypass from the station spawn to the east platform approach", () => {
    const station = getWorldZone(gardenWorld, "subway-station");
    const eastPortal = station.portals.find((portalItem) => portalItem.id === "station-to-train");
    const route = findTilePath(station, station.spawn, eastPortal!.approach);

    expect(route).not.toBeNull();
    expect(route?.at(-1)).toEqual(eastPortal?.approach);
    expect(route?.some((point) => point.y > 480)).toBe(true);
  });

  it("keeps every spawn and portal approach on a safe walkable tile", () => {
    for (const zone of gardenWorld.zones) {
      const points = [zone.spawn, ...zone.portals.map((portal) => portal.approach)];
      for (const point of points) {
        expect(isTileCenter(point.x, zone.bounds.x), `${zone.id} x=${point.x}`).toBe(true);
        expect(isTileCenter(point.y, zone.bounds.y), `${zone.id} y=${point.y}`).toBe(true);
        expect(pointInRect(point, zone.cameraSafeBounds), `${zone.id} safe point`).toBe(true);
        expect(isBlocked(point, zone), `${zone.id} blocked point`).toBe(false);
      }

      for (const portal of zone.portals) {
        const target = getWorldZone(gardenWorld, portal.to);
        expect(pointInRect(portal.spawn, target.cameraSafeBounds), `${portal.id} spawn`).toBe(true);
        expect(isTileCenter(portal.spawn.x, target.bounds.x), `${portal.id} spawn x`).toBe(true);
        expect(isTileCenter(portal.spawn.y, target.bounds.y), `${portal.id} spawn y`).toBe(true);
        expect(
          target.portals.some((targetPortal) =>
            targetPortal.approach.x === portal.spawn.x && targetPortal.approach.y === portal.spawn.y
          ),
          `${portal.id} spawn overlaps a portal approach`
        ).toBe(false);
      }
    }
  });

  it("connects the Task 8 train arrival through a minimal venue corridor without replacing the venue map", () => {
    const venue = getWorldZone(gardenWorld, "venue-exterior");
    const trainArrival = getWorldZone(gardenWorld, "subway-train").portals.find(
      (portalItem) => portalItem.id === "train-to-venue"
    );
    const arrival = trainArrival?.spawn;

    expect([venue.bounds.width, venue.bounds.height]).toEqual([840, 900]);
    expect(venue.paths).toEqual([
      { id: "venue-garden", kind: "garden", x: 60, y: 300, width: 720, height: 180 },
      { id: "venue-arrival", kind: "garden", x: 420, y: 300, width: 90, height: 510 }
    ]);
    expect(arrival).toEqual({ x: 465, y: 765 });
    expect(arrival && pointInRect(arrival, venue.cameraSafeBounds)).toBe(true);
    expect(arrival && isWalkable(arrival, venue)).toBe(true);
    expect(arrival && isBlocked(arrival, venue)).toBe(false);

    for (const portalItem of venue.portals) {
      const route = arrival ? findTilePath(venue, arrival, portalItem.approach) : null;
      expect(route, portalItem.id).not.toBeNull();
      expect(route?.at(-1), portalItem.id).toEqual(portalItem.approach);
      expect(route?.some((point) => point.y === 465), portalItem.id).toBe(true);
    }
  });

  it("gives every place paths, themed scenery, and a stable journey order", () => {
    for (const [index, zone] of gardenWorld.zones.entries()) {
      expect(zone.journeyIndex).toBe(index);
      expect(zone.theme).toBe(zone.id);
      expect(zone.paths.length).toBeGreaterThan(0);
      expect(zone.decorations.length).toBeGreaterThanOrEqual(8);
      expect(new Set(zone.decorations.map((item) => item.kind)).size).toBeGreaterThanOrEqual(4);
    }

    expect(getWorldZone(gardenWorld, "ceremony-hall").paths.some((path) => path.kind === "aisle")).toBe(true);
    expect(getWorldZone(gardenWorld, "neighborhood").paths.some((path) => path.kind === "crosswalk")).toBe(true);
    expect(getWorldZone(gardenWorld, "subway-train").paths.some((path) => path.kind === "carriage")).toBe(true);
  });

  it("keeps spots and portals from overlapping each other", () => {
    const intersects = (first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) =>
      first.x < second.x + second.width &&
      first.x + first.width > second.x &&
      first.y < second.y + second.height &&
      first.y + first.height > second.y;

    for (const zone of gardenWorld.zones) {
      for (const worldSpot of zone.spots) {
        for (const worldPortal of zone.portals) {
          expect(intersects(worldSpot, worldPortal), `${zone.id}/${worldSpot.id}/${worldPortal.id}`).toBe(false);
        }
      }
    }
  });
});
