import { describe, expect, it } from "vitest";
import { worldZoneIds } from "@wedding-game/shared";
import { isBlocked, pointInRect } from "./geometry";
import { gridTileSize } from "./movement";
import { gardenWorld, getWorldZone } from "./world";

const expectedSizes = {
  home: [600, 720],
  neighborhood: [960, 540],
  "subway-station": [720, 720],
  "subway-train": [1080, 480],
  "venue-exterior": [840, 720],
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
    expect(home.blocked.slice(0, 4)).toEqual([
      { x: 360, y: 240, width: 150, height: 90 },
      { x: 270, y: 330, width: 120, height: 90 },
      { x: 90, y: 480, width: 120, height: 120 },
      { x: 420, y: 480, width: 60, height: 90 }
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
