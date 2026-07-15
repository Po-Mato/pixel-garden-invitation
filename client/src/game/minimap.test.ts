import { describe, expect, it } from "vitest";
import {
  computeMiniMapViewportRect,
  createMiniMapLayout,
  projectMiniMapPoint,
  projectMiniMapRect
} from "./minimap";
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
    const layout = createMiniMapLayout({ x: 0, y: 0, width: 660, height: 1800 });

    expect(layout.width).toBeCloseTo(49.07, 1);
    expect(layout.height).toBe(120);
    expect(layout.content.width / layout.content.height).toBeCloseTo(660 / 1800);
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
