import { describe, expect, it } from "vitest";
import { invitationContent, realtimeWorldContract, worldZoneIds } from "@wedding-game/shared";
import mapManifest from "../../../map-assets/reference/v2/manifest.json";
import { isBlocked, isWalkable, pointInRect } from "./geometry";
import { gridTileSize } from "./movement";
import { findTilePath } from "./pathfinding";
import {
  gardenWorld,
  getWorldZone,
  pointInPortalEntry,
  portalEntryRect,
  portalEntryTileSize
} from "./world";

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
  banquet: [1200, 930]
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

  it.each(worldZoneIds)("matches the shared realtime contract for %s", (zoneId) => {
    const zone = getWorldZone(gardenWorld, zoneId);

    expect({
      spawn: zone.spawn,
      bounds: { width: zone.bounds.width, height: zone.bounds.height }
    }).toEqual(realtimeWorldContract[zoneId]);
  });

  it("matches every world zone to the v2 manifest background and depth assets", () => {
    expect(mapManifest.zones.map((zone) => zone.id)).toEqual(worldZoneIds);

    const manifestByZone = new Map(mapManifest.zones.map((zone) => [zone.id, zone]));

    for (const zone of gardenWorld.zones) {
      const manifestZone = manifestByZone.get(zone.id);
      const assetDecorations = zone.decorations.filter((decoration) => decoration.asset);
      const overlayOutputs = new Set(manifestZone?.overlays.map((overlay) => overlay.output) ?? []);

      expect(manifestZone, zone.id).toBeDefined();
      expect(manifestZone?.background.output, zone.id).toBe("background.webp");
      expect(
        [manifestZone?.background.width, manifestZone?.background.height],
        `${zone.id} manifest background size`
      ).toEqual([zone.bounds.width, zone.bounds.height]);
      expect(Array.isArray(manifestZone?.overlays), `${zone.id} manifest overlays`).toBe(true);

      for (const decoration of assetDecorations) {
        expect(overlayOutputs.has(decoration.asset!), `${zone.id} decoration asset ${decoration.asset}`).toBe(true);
      }

      for (const output of overlayOutputs) {
        expect(
          assetDecorations.some((decoration) => decoration.asset === output),
          `${zone.id} manifest overlay ${output}`
        ).toBe(true);
      }
    }
  });

  it("connects the full route and lobby branches with reverse portals", () => {
    const requiredEdges = [
      ["home", "neighborhood"],
      ["neighborhood", "subway-station"],
      ["subway-station", "subway-train"],
      ["subway-train", "venue-exterior"],
      ["venue-exterior", "lobby"],
      ["lobby", "bridal-room"],
      ["lobby", "ceremony-hall"],
      ["lobby", "banquet"],
      ["banquet", "restroom"]
    ] as const;

    for (const [from, to] of requiredEdges) {
      expect(getWorldZone(gardenWorld, from).portals.some((portal) => portal.to === to)).toBe(true);
      expect(getWorldZone(gardenWorld, to).portals.some((portal) => portal.to === from)).toBe(true);
    }
  });

  it("defines three walkable entry tiles perpendicular to every portal direction", () => {
    expect(portalEntryTileSize).toBe(30);

    let entryTileCount = 0;
    for (const zone of gardenWorld.zones) {
      for (const portal of zone.portals) {
        entryTileCount += portal.entryTiles.length;
        expect(portal.entryTiles, portal.id).toHaveLength(3);
        expect(portal.entryTiles, portal.id).toContainEqual(portal.approach);

        const xs = portal.entryTiles.map((tile) => tile.x);
        const ys = portal.entryTiles.map((tile) => tile.y);
        if (portal.facing === "up" || portal.facing === "down") {
          expect(new Set(xs).size, portal.id).toBe(3);
          expect(new Set(ys), portal.id).toEqual(new Set([portal.approach.y]));
        } else {
          expect(new Set(xs), portal.id).toEqual(new Set([portal.approach.x]));
          expect(new Set(ys).size, portal.id).toBe(3);
        }

        for (const tile of portal.entryTiles) {
          expect(isTileCenter(tile.x, zone.cameraSafeBounds.x), `${portal.id} x`).toBe(true);
          expect(isTileCenter(tile.y, zone.cameraSafeBounds.y), `${portal.id} y`).toBe(true);
          expect(isWalkable(tile, zone), `${portal.id} walkable`).toBe(true);
          expect(isBlocked(tile, zone), `${portal.id} blocked`).toBe(false);
          expect(pointInPortalEntry(portal, tile), `${portal.id} entry`).toBe(true);
        }
      }
    }

    expect(entryTileCount).toBe(54);
  });

  it("uses the exact contiguous tile strip as each portal entry rectangle", () => {
    for (const zone of gardenWorld.zones) {
      for (const portal of zone.portals) {
        const entry = portalEntryRect(portal);
        const horizontal = portal.facing === "up" || portal.facing === "down";

        expect([entry.width, entry.height], portal.id).toEqual(horizontal ? [90, 30] : [30, 90]);
        expect(pointInPortalEntry(portal, { x: entry.x + 1, y: entry.y + 1 }), portal.id).toBe(true);
        expect(pointInPortalEntry(portal, {
          x: entry.x - 1,
          y: entry.y + entry.height / 2
        }), portal.id).toBe(false);
        expect(pointInPortalEntry(portal, {
          x: entry.x + entry.width / 2,
          y: entry.y - 1
        }), portal.id).toBe(false);
      }
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
      { x: 400, y: 110, width: 140, height: 290 },
      { x: 340, y: 290, width: 65, height: 135 },
      { x: 15, y: 565, width: 115, height: 130 },
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

    for (const [id, rect] of [
      ["home-sofa", { x: 400, y: 110, width: 140, height: 290 }],
      ["home-table", { x: 340, y: 290, width: 65, height: 135 }],
      ["home-rack", { x: 15, y: 565, width: 115, height: 130 }]
    ] as const) {
      expect(home.decorations.find((item) => item.id === id)).toMatchObject(rect);
      expect(home.blocked).toContainEqual(rect);
    }
  });

  it.each([
    ["shoe rack", { x: 105, y: 615 }],
    ["sofa", { x: 465, y: 375 }],
    ["table", { x: 345, y: 300 }]
  ] as const)("blocks the home %s footprint", (_label, point) => {
    const home = getWorldZone(gardenWorld, "home");

    expect(isWalkable(point, home), `home furniture path ${point.x},${point.y}`).toBe(true);
    expect(isBlocked(point, home), `home furniture blocked ${point.x},${point.y}`).toBe(true);
  });

  it.each([
    ["former shoe-rack blocker", { x: 195, y: 525 }],
    ["central passage", { x: 285, y: 405 }]
  ] as const)("keeps the home %s walkable", (_label, point) => {
    const home = getWorldZone(gardenWorld, "home");

    expect(isWalkable(point, home), `home open path ${point.x},${point.y}`).toBe(true);
    expect(isBlocked(point, home), `home open floor ${point.x},${point.y}`).toBe(false);
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
      expect.objectContaining({ x: 214, y: 90, width: 90, height: 150, asset: "tree-canopy.png", depthY: 240 }),
      expect.objectContaining({ x: 513, y: 90, width: 90, height: 150, asset: "tree-canopy.png", depthY: 240 }),
      expect.objectContaining({ x: 860, y: 90, width: 90, height: 150, asset: "tree-canopy.png", depthY: 240 })
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

  it("defines an open v2 subway platform interior without ticket gates", () => {
    const station = getWorldZone(gardenWorld, "subway-station");
    const [directionsSpot] = station.spots;

    expect(station.spawn).toEqual({ x: 135, y: 435 });
    expect(station.paths).toEqual([
      { id: "station-concourse", kind: "floor", x: 60, y: 300, width: 600, height: 270 },
      { id: "station-platform-approach", kind: "corridor", x: 330, y: 240, width: 240, height: 390 },
      { id: "station-platform", kind: "platform", x: 600, y: 120, width: 210, height: 600 }
    ]);
    expect(station.spots).toEqual([
      expect.objectContaining({ id: "directions", x: 120, y: 150, width: 120, height: 90 })
    ]);
    expect(station.blocked).toEqual([directionsSpot]);
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
    expect(station.decorations.filter((item) => item.asset?.includes("ticket-gate"))).toEqual([]);
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

  it("finds a direct platform route from the station spawn to the east portal", () => {
    const station = getWorldZone(gardenWorld, "subway-station");
    const eastPortal = station.portals.find((portalItem) => portalItem.id === "station-to-train");
    const route = findTilePath(station, station.spawn, eastPortal!.approach);

    expect(route).not.toBeNull();
    expect(route?.at(-1)).toEqual(eastPortal?.approach);
    expect(route?.every((point) => point.y === station.spawn.y)).toBe(true);
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
        expect(
          target.paths.some((worldPath) => pointInRect(portal.spawn, worldPath)),
          `${portal.id} spawn inside destination path`
        ).toBe(true);
        expect(pointInRect(portal.spawn, target.cameraSafeBounds), `${portal.id} spawn`).toBe(true);
        expect(isTileCenter(portal.spawn.x, target.bounds.x), `${portal.id} spawn x`).toBe(true);
        expect(isTileCenter(portal.spawn.y, target.bounds.y), `${portal.id} spawn y`).toBe(true);
        expect(isWalkable(portal.spawn, target), `${portal.id} spawn walkable`).toBe(true);
        expect(isBlocked(portal.spawn, target), `${portal.id} spawn blocked`).toBe(false);
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
        id: "lobby-to-banquet",
        to: "banquet",
        x: 960,
        y: 345,
        width: 90,
        height: 120,
        approach: { x: 975, y: 405 },
        facing: "right",
        spawn: { x: 135, y: 465 }
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
      y: 320,
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
      { id: "bride", label: `신부 ${invitationContent.event.couple.bride}`, x: 360, y: 285 }
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
    const banquet = getWorldZone(gardenWorld, "banquet");
    const restroom = getWorldZone(gardenWorld, "restroom");
    const hall = getWorldZone(gardenWorld, "ceremony-hall");

    expect(getWorldZone(gardenWorld, "venue-exterior").portals.find((portalItem) => portalItem.id === "venue-to-lobby")?.spawn)
      .toEqual({ x: 525, y: 765 });
    expect(bridal.portals.find((portalItem) => portalItem.id === "bridal-to-lobby")?.spawn).toEqual({ x: 135, y: 405 });
    expect(banquet.portals.find((portalItem) => portalItem.id === "banquet-to-lobby")?.spawn).toEqual({ x: 945, y: 405 });
    expect(restroom.portals.find((portalItem) => portalItem.id === "restroom-to-banquet")?.spawn).toEqual({ x: 1065, y: 465 });
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

  it("defines the restroom contract connected only to the banquet", () => {
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
        id: "restroom-to-banquet",
        to: "banquet",
        x: 30,
        y: 285,
        width: 90,
        height: 120,
        approach: { x: 105, y: 345 },
        facing: "left",
        spawn: { x: 1065, y: 465 }
      })
    ]);
    expect(restroom.subtitle).toBe("연회장 옆 밝은 테라조 공간에서 잠시 단정히 준비해요");
    expect(restroom.decorations).toContainEqual(expect.objectContaining({
      id: "restroom-door",
      label: "연회장 출입문"
    }));
    expect(restroom.decorations.filter((item) => item.asset === "stall-front.png")).toHaveLength(0);

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
      { id: "groom", label: `신랑 ${invitationContent.event.couple.groom}`, x: 360, y: 255 },
      { id: "bride", label: `신부 ${invitationContent.event.couple.bride}`, x: 420, y: 255 }
    ]);
    expect(hall.npcs[1].x - hall.npcs[0].x).toBe(60);
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
      })
    ]);
    expect(hall.decorations.filter((item) => item.kind === "aisle-bouquet")).toEqual([
      expect.objectContaining({ x: 240, y: 480, width: 60, height: 90, asset: "aisle-bouquet-front.png", depthY: 570 }),
      expect.objectContaining({ x: 480, y: 720, width: 60, height: 90, asset: "aisle-bouquet-front.png", depthY: 810 }),
      expect.objectContaining({ x: 240, y: 960, width: 60, height: 90, asset: "aisle-bouquet-front.png", depthY: 1050 }),
      expect.objectContaining({ x: 480, y: 1200, width: 60, height: 90, asset: "aisle-bouquet-front.png", depthY: 1290 })
    ]);
    expect(hall.decorations.find((item) => item.id === "hall-ceremony-arch")).toEqual(
      expect.objectContaining({
        kind: "flower-arch",
        x: 180,
        y: 30,
        width: 420,
        height: 300,
        asset: "ceremony-arch-front.png",
        depthY: 330
      })
    );
    expect(hall.decorations.find((item) => item.id === "hall-altar-table-front")).toEqual(
      expect.objectContaining({
        kind: "altar",
        x: 300,
        y: 165,
        width: 180,
        height: 120,
        asset: "altar-table-front.png",
        depthY: 240
      })
    );
  });

  it("defines the banquet between lobby and restroom with complete table depths", () => {
    const banquet = getWorldZone(gardenWorld, "banquet");
    const lobbyToBanquet = getWorldZone(gardenWorld, "lobby").portals.find((portalItem) => portalItem.id === "lobby-to-banquet");
    const restroomToBanquet = getWorldZone(gardenWorld, "restroom").portals.find((portalItem) => portalItem.id === "restroom-to-banquet");
    const guestbookSpot = banquet.spots[0];
    const tableRects = [
      { x: 210, y: 270, width: 240, height: 240 },
      { x: 690, y: 270, width: 240, height: 240 },
      { x: 210, y: 570, width: 240, height: 240 },
      { x: 690, y: 570, width: 240, height: 240 }
    ];

    expect([banquet.bounds.width, banquet.bounds.height]).toEqual([1200, 930]);
    expect(banquet.spawn).toEqual({ x: 135, y: 465 });
    expect(lobbyToBanquet?.spawn).toEqual({ x: 135, y: 465 });
    expect(restroomToBanquet?.spawn).toEqual({ x: 1065, y: 465 });
    expect(banquet.paths).toEqual([
      { id: "banquet-floor", kind: "banquet", x: 60, y: 90, width: 1080, height: 750 },
      { id: "banquet-central", kind: "corridor", x: 60, y: 360, width: 1080, height: 210 }
    ]);
    expect(banquet.paths.some((worldPath) => worldPath.id === "banquet-arrival")).toBe(false);
    expect(banquet.spots).toEqual([
      expect.objectContaining({ id: "guestbook", x: 990, y: 690, width: 120, height: 90 })
    ]);
    expect(banquet.blocked).toEqual([
      ...tableRects,
      { x: 450, y: 90, width: 300, height: 90 },
      guestbookSpot
    ]);
    expect(banquet.portals).toEqual([
      expect.objectContaining({
        id: "banquet-to-lobby",
        to: "lobby",
        x: 30,
        y: 405,
        width: 90,
        height: 120,
        approach: { x: 105, y: 465 },
        facing: "left",
        spawn: { x: 945, y: 405 }
      }),
      expect.objectContaining({
        id: "banquet-to-restroom",
        to: "restroom",
        x: 1080,
        y: 405,
        width: 90,
        height: 120,
        approach: { x: 1095, y: 465 },
        facing: "right",
        spawn: { x: 135, y: 345 }
      })
    ]);
    expect(banquet.decorations.filter((item) => item.kind === "banquet-table")).toEqual([
      expect.objectContaining({ id: "banquet-table-1", ...tableRects[0], asset: "table-floral.png", depthY: 510 }),
      expect.objectContaining({ id: "banquet-table-2", ...tableRects[1], asset: "table-dining.png", depthY: 510 }),
      expect.objectContaining({ id: "banquet-table-3", ...tableRects[2], asset: "table-dining.png", depthY: 810 }),
      expect.objectContaining({ id: "banquet-table-4", ...tableRects[3], asset: "table-floral.png", depthY: 810 })
    ]);
    expect(banquet.decorations.some((item) => item.asset === "table-front.png")).toBe(false);

    for (const spawn of [lobbyToBanquet?.spawn, restroomToBanquet?.spawn]) {
      expect(spawn && isWalkable(spawn, banquet)).toBe(true);
      expect(spawn && isBlocked(spawn, banquet)).toBe(false);
      for (const goal of [...banquet.portals.map((portalItem) => portalItem.approach), { x: 975, y: 735 }]) {
        const route = spawn ? findTilePath(banquet, spawn, goal) : null;
        expect(route, `banquet ${spawn?.x},${spawn?.y} -> ${goal.x},${goal.y}`).not.toBeNull();
        expect(route?.at(-1)).toEqual(goal);
      }
    }

    for (const blockedPoint of [
      { x: 225, y: 285 },
      { x: 705, y: 285 },
      { x: 225, y: 585 },
      { x: 705, y: 585 },
      { x: 465, y: 105 }
    ]) {
      expect(isBlocked(blockedPoint, banquet), `banquet blocked ${blockedPoint.x},${blockedPoint.y}`).toBe(true);
    }
  });

  it("gives every place paths, themed scenery, and a stable journey order", () => {
    for (const [index, zone] of gardenWorld.zones.entries()) {
      expect(zone.journeyIndex).toBe(index);
      expect(zone.theme).toBe(zone.id);
      expect(zone.paths.length).toBeGreaterThan(0);
      if (zone.id !== "bridal-room") {
        const minimumDecorationCount = zone.id === "subway-station"
          ? 6
          : zone.id === "restroom"
            ? 7
            : 8;
        expect(zone.decorations.length).toBeGreaterThanOrEqual(minimumDecorationCount);
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
