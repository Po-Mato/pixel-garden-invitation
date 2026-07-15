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
  "venue-exterior": [960, 900],
  lobby: [1080, 900],
  "bridal-room": [720, 630],
  "ceremony-hall": [780, 1920],
  restroom: [660, 660],
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

    expect(new Set(gardenWorld.zones.map((zone) => `${zone.bounds.width}x${zone.bounds.height}`)).size).toBeGreaterThanOrEqual(9);
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

  it("defines the exact Task 9 venue exterior with top and bottom portals", () => {
    const venue = getWorldZone(gardenWorld, "venue-exterior");

    expect(venue.spawn).toEqual({ x: 465, y: 765 });
    expect(venue.paths).toEqual([
      { id: "venue-garden", kind: "garden", x: 90, y: 570, width: 780, height: 180 },
      { id: "venue-plaza", kind: "garden", x: 240, y: 300, width: 480, height: 360 },
      { id: "venue-central", kind: "garden", x: 390, y: 60, width: 180, height: 780 }
    ]);
    expect(venue.blocked).toEqual([{ x: 240, y: 450, width: 120, height: 120 }]);
    expect(venue.paths.some((item) => item.id === "venue-arrival")).toBe(false);
    expect(venue.portals).toEqual([
      expect.objectContaining({
        id: "venue-to-train",
        to: "subway-train",
        x: 420,
        y: 810,
        width: 90,
        height: 60,
        approach: { x: 465, y: 795 },
        facing: "down",
        spawn: { x: 1305, y: 285 }
      }),
      expect.objectContaining({
        id: "venue-to-lobby",
        to: "lobby",
        x: 405,
        y: 30,
        width: 120,
        height: 90,
        approach: { x: 465, y: 105 },
        facing: "up",
        spawn: { x: 525, y: 765 }
      })
    ]);
    expect(venue.decorations).toContainEqual(expect.objectContaining({
      id: "venue-arch",
      kind: "flower-arch",
      x: 360,
      y: 180,
      width: 240,
      height: 180,
      asset: "flower-arch-front.png",
      depthY: 360
    }));
  });

  it("routes around the Task 9 venue fountain between bottom arrival and the lobby", () => {
    const venue = getWorldZone(gardenWorld, "venue-exterior");
    const trainArrival = getWorldZone(gardenWorld, "subway-train").portals.find(
      (portalItem) => portalItem.id === "train-to-venue"
    );
    const lobbyPortal = venue.portals.find((portalItem) => portalItem.id === "venue-to-lobby");
    const trainPortal = venue.portals.find((portalItem) => portalItem.id === "venue-to-train");
    const fountainBypass = findTilePath(venue, { x: 285, y: 615 }, { x: 285, y: 405 });
    const arrivalToLobby = findTilePath(venue, trainArrival!.spawn, lobbyPortal!.approach);

    expect(trainArrival?.spawn).toEqual(venue.spawn);
    expect(fountainBypass).not.toBeNull();
    expect(fountainBypass?.at(-1)).toEqual({ x: 285, y: 405 });
    expect(fountainBypass?.some((point) => point.x === 375), "route should side-step the fountain").toBe(true);
    for (const point of fountainBypass ?? []) {
      expect(isBlocked(point, venue), `venue fountain bypass blocked at ${point.x},${point.y}`).toBe(false);
    }

    expect(arrivalToLobby).not.toBeNull();
    expect(arrivalToLobby?.at(-1)).toEqual(lobbyPortal?.approach);
    const roundTrip = findTilePath(venue, lobbyPortal!.approach, trainPortal!.approach);
    expect(roundTrip).not.toBeNull();
    expect(roundTrip?.at(-1)).toEqual(trainPortal?.approach);
  });

  it("defines the exact Task 10 lobby contract with four portals and desk depth overlay", () => {
    const lobby = getWorldZone(gardenWorld, "lobby");
    const [weddingInfo, rsvp, gallery, story] = lobby.spots;

    expect([lobby.bounds.width, lobby.bounds.height]).toEqual([1080, 900]);
    expect(lobby.spawn).toEqual({ x: 525, y: 765 });
    expect(lobby.paths).toEqual([
      { id: "lobby-main", kind: "lobby", x: 90, y: 300, width: 900, height: 300 },
      { id: "lobby-vertical", kind: "corridor", x: 420, y: 90, width: 240, height: 720 },
      { id: "lobby-upper", kind: "lobby", x: 90, y: 180, width: 900, height: 180 },
      { id: "lobby-lower", kind: "lobby", x: 90, y: 540, width: 900, height: 240 }
    ]);
    expect(lobby.paths.some((worldPath) => worldPath.id === "lobby-arrival")).toBe(false);
    expect(lobby.spots).toEqual([
      expect.objectContaining({ id: "wedding-info", x: 180, y: 180, width: 120, height: 90 }),
      expect.objectContaining({ id: "rsvp", x: 300, y: 630, width: 120, height: 90 }),
      expect.objectContaining({ id: "gallery", x: 690, y: 180, width: 120, height: 90 }),
      expect.objectContaining({ id: "story", x: 780, y: 630, width: 120, height: 90 })
    ]);
    expect(lobby.blocked).toEqual([
      { x: 450, y: 300, width: 180, height: 120 },
      weddingInfo,
      rsvp,
      gallery,
      story
    ]);
    expect(lobby.portals).toEqual([
      expect.objectContaining({
        id: "lobby-to-venue",
        to: "venue-exterior",
        x: 480,
        y: 810,
        width: 120,
        height: 60,
        approach: { x: 525, y: 795 },
        facing: "down",
        spawn: { x: 465, y: 135 }
      }),
      expect.objectContaining({
        id: "lobby-to-bridal",
        to: "bridal-room",
        x: 30,
        y: 345,
        width: 90,
        height: 120,
        approach: { x: 105, y: 405 },
        facing: "left",
        spawn: { x: 345, y: 525 }
      }),
      expect.objectContaining({
        id: "lobby-to-restroom",
        to: "restroom",
        x: 960,
        y: 345,
        width: 90,
        height: 120,
        approach: { x: 975, y: 405 },
        facing: "right",
        spawn: { x: 135, y: 345 }
      }),
      expect.objectContaining({
        id: "lobby-to-hall",
        to: "ceremony-hall",
        x: 480,
        y: 30,
        width: 120,
        height: 90,
        approach: { x: 525, y: 105 },
        facing: "up",
        spawn: { x: 375, y: 1785 }
      })
    ]);
    expect(lobby.decorations).toContainEqual(expect.objectContaining({
      id: "lobby-desk",
      kind: "reception-desk",
      x: 450,
      y: 300,
      width: 180,
      height: 120,
      asset: "reception-desk-front.png",
      depthY: 420
    }));

    for (const portalItem of lobby.portals) {
      const route = findTilePath(lobby, lobby.spawn, portalItem.approach);
      expect(route, portalItem.id).not.toBeNull();
      expect(route?.at(-1), portalItem.id).toEqual(portalItem.approach);
    }
  });

  it("defines the exact Task 11 bridal room contract with reachable NPC, spot, blockers, portal, and flower depth", () => {
    const bridal = getWorldZone(gardenWorld, "bridal-room");
    const coupleSpot = bridal.spots[0];

    expect([bridal.bounds.width, bridal.bounds.height]).toEqual([720, 630]);
    expect(bridal.spawn).toEqual({ x: 345, y: 525 });
    expect(bridal.paths).toEqual([
      { id: "bridal-floor", kind: "floor", x: 90, y: 90, width: 540, height: 450 },
      { id: "bridal-entry", kind: "floor", x: 300, y: 510, width: 120, height: 90 }
    ]);
    expect(bridal.paths.some((worldPath) => worldPath.id === "bridal-entry-corridor")).toBe(false);
    expect(bridal.spots).toEqual([
      expect.objectContaining({ id: "couple", x: 150, y: 150, width: 120, height: 90 })
    ]);
    expect(bridal.npcs).toEqual([
      { id: "bride", label: "신부 김하린", x: 360, y: 285 }
    ]);
    expect(bridal.blocked).toEqual([
      { x: 90, y: 330, width: 180, height: 90 },
      { x: 510, y: 240, width: 90, height: 120 },
      coupleSpot
    ]);
    expect(bridal.portals).toEqual([
      expect.objectContaining({
        id: "bridal-to-lobby",
        to: "lobby",
        x: 300,
        y: 540,
        width: 120,
        height: 60,
        approach: { x: 345, y: 555 },
        facing: "down",
        spawn: { x: 135, y: 405 }
      })
    ]);
    expect(bridal.decorations).toEqual([
      expect.objectContaining({
        id: "bridal-flower-front",
        kind: "flower-bed",
        x: 240,
        y: 300,
        width: 90,
        height: 120,
        asset: "flower-arrangement-front.png",
        depthY: 420
      })
    ]);
    expect(bridal.decorations.some((item) => ["bridal-photo-wall", "bridal-flower-1", "bridal-flower-2", "bridal-door"].includes(item.id)))
      .toBe(false);

    expect(isWalkable(bridal.npcs[0], bridal)).toBe(true);
    expect(isBlocked(bridal.npcs[0], bridal)).toBe(false);

    for (const target of [bridal.portals[0].approach, { x: 165, y: 255 }, { x: 345, y: 285 }]) {
      const route = findTilePath(bridal, bridal.spawn, target);
      expect(route, `bridal route to ${target.x},${target.y}`).not.toBeNull();
      expect(route?.at(-1), `bridal route to ${target.x},${target.y}`).toEqual({ x: target.x, y: target.y });
      for (const point of route ?? []) {
        expect(isWalkable(point, bridal), `bridal walkable ${point.x},${point.y}`).toBe(true);
        expect(isBlocked(point, bridal), `bridal blocked ${point.x},${point.y}`).toBe(false);
      }
    }
  });

  it("syncs reverse portal destinations and keeps future lobby destinations connected", () => {
    const lobby = getWorldZone(gardenWorld, "lobby");
    const bridal = getWorldZone(gardenWorld, "bridal-room");
    const restroom = getWorldZone(gardenWorld, "restroom");
    const hall = getWorldZone(gardenWorld, "ceremony-hall");

    expect(getWorldZone(gardenWorld, "venue-exterior").portals.find((portalItem) => portalItem.id === "venue-to-lobby")?.spawn)
      .toEqual({ x: 525, y: 765 });
    expect(bridal.portals.find((portalItem) => portalItem.id === "bridal-to-lobby")?.spawn).toEqual({ x: 135, y: 405 });
    expect(restroom.portals.find((portalItem) => portalItem.id === "restroom-to-lobby")?.spawn).toEqual({ x: 945, y: 405 });
    expect(hall.portals.find((portalItem) => portalItem.id === "hall-to-lobby")?.spawn).toEqual({ x: 525, y: 135 });

    for (const portalItem of lobby.portals) {
      const destination = getWorldZone(gardenWorld, portalItem.to);
      expect(pointInRect(portalItem.spawn, destination.cameraSafeBounds), portalItem.id).toBe(true);
      expect(isWalkable(portalItem.spawn, destination), portalItem.id).toBe(true);
      expect(isBlocked(portalItem.spawn, destination), portalItem.id).toBe(false);
      for (const exit of destination.portals) {
        const route = findTilePath(destination, portalItem.spawn, exit.approach);
        expect(route, `${portalItem.id} -> ${exit.id}`).not.toBeNull();
        expect(route?.at(-1), `${portalItem.id} -> ${exit.id}`).toEqual(exit.approach);
      }
    }
  });

  it("defines the exact Task 13 restroom contract with reachable portal and stall depth", () => {
    const restroom = getWorldZone(gardenWorld, "restroom");

    expect([restroom.bounds.width, restroom.bounds.height]).toEqual([660, 660]);
    expect(restroom.spawn).toEqual({ x: 135, y: 345 });
    expect(restroom.paths).toEqual([
      { id: "restroom-floor", kind: "floor", x: 90, y: 150, width: 480, height: 390 },
      { id: "restroom-entry", kind: "floor", x: 60, y: 270, width: 90, height: 150 }
    ]);
    expect(restroom.blocked).toEqual([
      { x: 150, y: 150, width: 240, height: 90 },
      { x: 420, y: 240, width: 150, height: 240 }
    ]);
    expect(restroom.portals).toEqual([
      expect.objectContaining({
        id: "restroom-to-lobby",
        to: "lobby",
        x: 30,
        y: 285,
        width: 90,
        height: 120,
        approach: { x: 105, y: 345 },
        facing: "left",
        spawn: { x: 945, y: 405 }
      })
    ]);
    expect(restroom.decorations).toContainEqual(expect.objectContaining({
      id: "restroom-stall-front",
      kind: "stall",
      x: 420,
      y: 240,
      width: 150,
      height: 240,
      asset: "stall-front.png",
      depthY: 480
    }));
    expect(restroom.decorations.filter((item) => item.asset === "stall-front.png")).toHaveLength(1);

    for (const target of [
      { x: 135, y: 315 },
      { x: 135, y: 375 },
      { x: 105, y: 345 },
      { x: 165, y: 345 },
      restroom.portals[0].approach
    ]) {
      expect(isWalkable(target, restroom), `restroom walkable ${target.x},${target.y}`).toBe(true);
      expect(isBlocked(target, restroom), `restroom blocked ${target.x},${target.y}`).toBe(false);
    }
    for (const blockedPoint of [{ x: 165, y: 165 }, { x: 435, y: 255 }]) {
      expect(isBlocked(blockedPoint, restroom), `restroom blocked ${blockedPoint.x},${blockedPoint.y}`).toBe(true);
    }

    const route = findTilePath(restroom, restroom.spawn, restroom.portals[0].approach);
    expect(route).not.toBeNull();
    expect(route?.at(-1)).toEqual(restroom.portals[0].approach);
  });

  it("defines the exact Task 12 long ceremony hall contract", () => {
    const hall = getWorldZone(gardenWorld, "ceremony-hall");
    const coupleSpot = hall.spots[0];

    expect([hall.bounds.width, hall.bounds.height]).toEqual([780, 1920]);
    expect(hall.spawn).toEqual({ x: 375, y: 1785 });
    expect(hall.paths).toEqual([
      { id: "hall-aisle", kind: "aisle", x: 300, y: 90, width: 180, height: 1740 },
      { id: "hall-altar-cross", kind: "aisle", x: 180, y: 120, width: 420, height: 240 },
      { id: "hall-entry", kind: "corridor", x: 240, y: 1740, width: 300, height: 120 }
    ]);
    expect(hall.paths.some((worldPath) => worldPath.id === "hall-entry-corridor")).toBe(false);
    expect(hall.spots).toEqual([
      expect.objectContaining({ id: "couple", x: 180, y: 150, width: 90, height: 90 })
    ]);
    expect(hall.blocked).toEqual([coupleSpot]);
    expect(hall.npcs).toEqual([
      { id: "groom", label: "신랑 이서준", x: 330, y: 255 },
      { id: "bride", label: "신부 김하린", x: 450, y: 255 }
    ]);
    expect(hall.portals).toEqual([
      expect.objectContaining({
        id: "hall-to-lobby",
        to: "lobby",
        x: 330,
        y: 1830,
        width: 120,
        height: 60,
        approach: { x: 375, y: 1815 },
        facing: "down",
        spawn: { x: 525, y: 135 }
      }),
      expect.objectContaining({
        id: "hall-to-banquet",
        to: "banquet",
        x: 330,
        y: 30,
        width: 120,
        height: 90,
        approach: { x: 375, y: 105 },
        facing: "up",
        spawn: { x: 585, y: 795 }
      })
    ]);
    expect(hall.decorations.filter((item) => item.kind === "aisle-bouquet")).toEqual([
      expect.objectContaining({ x: 270, y: 480, width: 60, height: 90, asset: "aisle-bouquet-front.png", depthY: 570 }),
      expect.objectContaining({ x: 420, y: 720, width: 60, height: 90, asset: "aisle-bouquet-front.png", depthY: 810 }),
      expect.objectContaining({ x: 270, y: 960, width: 60, height: 90, asset: "aisle-bouquet-front.png", depthY: 1050 }),
      expect.objectContaining({ x: 420, y: 1200, width: 60, height: 90, asset: "aisle-bouquet-front.png", depthY: 1290 })
    ]);
  });

  it("keeps the Task 12 banquet arrival corridor minimal and connected", () => {
    const banquet = getWorldZone(gardenWorld, "banquet");
    const hallToBanquet = getWorldZone(gardenWorld, "ceremony-hall").portals.find((portalItem) => portalItem.id === "hall-to-banquet");
    const returnPortal = banquet.portals.find((portalItem) => portalItem.id === "banquet-to-hall");

    expect(hallToBanquet?.spawn).toEqual({ x: 585, y: 795 });
    expect(banquet.paths).toEqual([
      { id: "banquet-floor", kind: "banquet", x: 60, y: 90, width: 960, height: 660 },
      { id: "banquet-arrival", kind: "corridor", x: 525, y: 720, width: 120, height: 90 }
    ]);
    expect(hallToBanquet && isWalkable(hallToBanquet.spawn, banquet)).toBe(true);
    expect(hallToBanquet && isBlocked(hallToBanquet.spawn, banquet)).toBe(false);

    const route = hallToBanquet && returnPortal
      ? findTilePath(banquet, hallToBanquet.spawn, returnPortal.approach)
      : null;
    expect(route).not.toBeNull();
    expect(route?.at(-1)).toEqual(returnPortal?.approach);
  });

  it("gives every place paths, themed scenery, and a stable journey order", () => {
    for (const [index, zone] of gardenWorld.zones.entries()) {
      expect(zone.journeyIndex).toBe(index);
      expect(zone.theme).toBe(zone.id);
      expect(zone.paths.length).toBeGreaterThan(0);
      if (zone.id !== "bridal-room") {
        expect(zone.decorations.length).toBeGreaterThanOrEqual(8);
        expect(new Set(zone.decorations.map((item) => item.kind)).size).toBeGreaterThanOrEqual(4);
      }
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
