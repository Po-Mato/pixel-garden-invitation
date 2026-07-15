import { describe, expect, it } from "vitest";
import {
  computeMiniMapViewportRect,
  createMiniMapLayout,
  projectMiniMapPoint,
  projectMiniMapRect
} from "./minimap";
import { computeCameraTransform } from "./camera";
import { gardenWorld, getWorldZone } from "./world";

describe("minimap projection", () => {
  it("fits a wide map inside the regular 96px square while preserving aspect ratio", () => {
    const layout = createMiniMapLayout({ x: 0, y: 0, width: 960, height: 540 });

    expect(layout.width).toBe(96);
    expect(layout.height).toBeCloseTo(57.5);
    expect(layout.content.width / layout.content.height).toBeCloseTo(960 / 540);
  });

  it("fits the 8:3 subway train inside the regular minimap", () => {
    const train = getWorldZone(gardenWorld, "subway-train");
    const layout = createMiniMapLayout(train.bounds);

    expect(layout.width).toBe(96);
    expect(layout.height).toBe(41);
    expect(layout.content.width / layout.content.height).toBeCloseTo(8 / 3);
  });

  it("uses the tall 72 by 120 limit for the ceremony hall", () => {
    const hall = getWorldZone(gardenWorld, "ceremony-hall");
    const layout = createMiniMapLayout(hall.bounds);

    expect(layout.width).toBeCloseTo(53.5, 1);
    expect(layout.height).toBe(120);
    expect(layout.content.width / layout.content.height).toBeCloseTo(780 / 1920);
  });

  it("projects Task 12 ceremony hall route markers and portals inside the tall minimap", () => {
    const hall = getWorldZone(gardenWorld, "ceremony-hall");
    const layout = createMiniMapLayout(hall.bounds);

    expect(layout.height).toBeLessThanOrEqual(120);
    expect(projectMiniMapPoint(hall.spawn, hall.bounds, layout)).toEqual({
      x: layout.content.x + 375 * layout.scale,
      y: layout.content.y + 1785 * layout.scale
    });

    for (const marker of [...hall.paths, ...hall.portals, ...hall.spots, ...hall.blocked]) {
      const projected = projectMiniMapRect(marker, hall.bounds, layout);
      expect(projected.x).toBeGreaterThanOrEqual(layout.content.x);
      expect(projected.y).toBeGreaterThanOrEqual(layout.content.y);
      expect(projected.x + projected.width).toBeLessThanOrEqual(layout.content.x + layout.content.width + 0.001);
      expect(projected.y + projected.height).toBeLessThanOrEqual(layout.content.y + layout.content.height + 0.001);
    }
  });

  it("fits the expanded subway station and its ticket-gate bypass inside the regular minimap", () => {
    const station = getWorldZone(gardenWorld, "subway-station");
    const layout = createMiniMapLayout(station.bounds);

    expect(layout.width).toBe(96);
    expect(layout.height).toBeCloseTo(90.13, 2);
    for (const marker of [...station.paths, ...station.portals, ...station.blocked]) {
      const projected = projectMiniMapRect(marker, station.bounds, layout);
      expect(projected.x).toBeGreaterThanOrEqual(layout.content.x);
      expect(projected.y).toBeGreaterThanOrEqual(layout.content.y);
      expect(projected.x + projected.width).toBeLessThanOrEqual(layout.content.x + layout.content.width);
      expect(projected.y + projected.height).toBeLessThanOrEqual(layout.content.y + layout.content.height);
    }
  });

  it("projects the Task 9 venue fountain and vertical portals inside the minimap", () => {
    const venue = getWorldZone(gardenWorld, "venue-exterior");
    const layout = createMiniMapLayout(venue.bounds);

    expect(layout.width).toBe(96);
    expect(layout.height).toBeCloseTo(90.5, 1);
    for (const marker of [...venue.portals, ...venue.blocked]) {
      const projected = projectMiniMapRect(marker, venue.bounds, layout);
      expect(projected.x).toBeGreaterThanOrEqual(layout.content.x);
      expect(projected.y).toBeGreaterThanOrEqual(layout.content.y);
      expect(projected.x + projected.width).toBeLessThanOrEqual(layout.content.x + layout.content.width + 0.001);
      expect(projected.y + projected.height).toBeLessThanOrEqual(layout.content.y + layout.content.height + 0.001);
    }
  });

  it("projects world points and rectangles into minimap coordinates", () => {
    const bounds = { x: 0, y: 0, width: 480, height: 600 };
    const layout = createMiniMapLayout(bounds);

    expect(projectMiniMapPoint({ x: 240, y: 300 }, bounds, layout)).toEqual({
      x: layout.width / 2,
      y: layout.height / 2
    });
    expect(projectMiniMapRect({ x: 120, y: 150, width: 240, height: 300 }, bounds, layout)).toEqual({
      x: layout.content.x + layout.content.width / 4,
      y: layout.content.y + layout.content.height / 4,
      width: layout.content.width / 2,
      height: layout.content.height / 2
    });
  });

  it("clips the camera viewport to the map before projecting it", () => {
    const bounds = { x: 0, y: 0, width: 480, height: 600 };
    const layout = createMiniMapLayout(bounds);
    const rect = computeMiniMapViewportRect({
      bounds,
      layout,
      viewport: { width: 390, height: 520 },
      camera: { x: 60, y: -145, zoom: 1 }
    });

    expect(rect.x).toBe(layout.content.x);
    expect(rect.y).toBeCloseTo(layout.content.y + 145 * layout.scale);
    expect(rect.width).toBeCloseTo(330 * layout.scale);
    expect(rect.height).toBeCloseTo(455 * layout.scale);
  });

  it.each([
    ["top", 105, 0],
    ["bottom", 1815, 1400]
  ])("projects the full viewport at the hall %s camera boundary", (_edge, playerY, expectedWorldTop) => {
    const hall = getWorldZone(gardenWorld, "ceremony-hall");
    const viewport = { width: 390, height: 520 };
    const layout = createMiniMapLayout(hall.bounds);
    const camera = computeCameraTransform({
      player: { x: 375, y: playerY },
      viewport,
      bounds: hall.bounds,
      zoom: 1
    });
    const rect = computeMiniMapViewportRect({ bounds: hall.bounds, layout, viewport, camera });

    expect(rect.x).toBeCloseTo(layout.content.x + 180 * layout.scale);
    expect(rect.y).toBeCloseTo(layout.content.y + expectedWorldTop * layout.scale);
    expect(rect.width).toBeCloseTo(390 * layout.scale);
    expect(rect.height).toBeCloseTo(520 * layout.scale);
  });

  it("keeps every zone and its route markers inside the minimap limits", () => {
    for (const zone of gardenWorld.zones) {
      const layout = createMiniMapLayout(zone.bounds);
      const limitWidth = zone.id === "ceremony-hall" ? 72 : 96;
      const limitHeight = zone.id === "ceremony-hall" ? 120 : 96;

      expect(layout.width).toBeGreaterThan(0);
      expect(layout.height).toBeGreaterThan(0);
      expect(layout.width).toBeLessThanOrEqual(limitWidth);
      expect(layout.height).toBeLessThanOrEqual(limitHeight);

      for (const marker of [...zone.paths, ...zone.portals, ...zone.spots, ...zone.blocked]) {
        const projected = projectMiniMapRect(marker, zone.bounds, layout);
        expect(projected.x).toBeGreaterThanOrEqual(layout.content.x);
        expect(projected.y).toBeGreaterThanOrEqual(layout.content.y);
        expect(projected.x + projected.width).toBeLessThanOrEqual(layout.content.x + layout.content.width + 0.001);
        expect(projected.y + projected.height).toBeLessThanOrEqual(layout.content.y + layout.content.height + 0.001);
      }
    }
  });
});
