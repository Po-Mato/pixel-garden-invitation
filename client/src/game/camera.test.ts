import { describe, expect, it } from "vitest";
import { computeCameraTransform, screenToWorld } from "./camera";

describe("tracking camera", () => {
  it("projects the player onto the exact viewport center", () => {
    const camera = computeCameraTransform({
      player: { x: 315, y: 1200 },
      viewport: { width: 390, height: 520 },
      bounds: { width: 780, height: 1920 },
      zoom: 1
    });

    expect(camera).toEqual({ x: -120, y: -940, zoom: 1 });
    expect(315 * camera.zoom + camera.x).toBe(195);
    expect(1200 * camera.zoom + camera.y).toBe(260);
  });

  it("keeps the center invariant at another zoom and viewport", () => {
    const camera = computeCameraTransform({
      player: { x: 525, y: 735 },
      viewport: { width: 320, height: 400 },
      bounds: { width: 1080, height: 1200 },
      zoom: 0.8
    });

    expect(525 * camera.zoom + camera.x).toBeCloseTo(160);
    expect(735 * camera.zoom + camera.y).toBeCloseTo(200);
  });

  it("clamps the east subway-train portal to the map edges", () => {
    const camera = computeCameraTransform({
      player: { x: 1335, y: 285 },
      viewport: { width: 390, height: 520 },
      bounds: { width: 1440, height: 540 },
      zoom: 1
    });

    expect(camera).toEqual({ x: -1050, y: -20, zoom: 1 });
    expect(1335 * camera.zoom + camera.x).toBe(285);
    expect(285 * camera.zoom + camera.y).toBe(265);
  });

  it("clamps the Task 8 venue bottom arrival to the map edge", () => {
    const camera = computeCameraTransform({
      player: { x: 465, y: 765 },
      viewport: { width: 390, height: 520 },
      bounds: { width: 960, height: 900 },
      zoom: 1
    });
    const screenX = 465 * camera.zoom + camera.x;
    const screenY = 765 * camera.zoom + camera.y;

    expect(camera).toEqual({ x: -270, y: -380, zoom: 1 });
    expect(screenX).toBe(195);
    expect(screenY).toBe(385);
    expect(screenX).toBeGreaterThanOrEqual(0);
    expect(screenX).toBeLessThanOrEqual(390);
    expect(screenY).toBeGreaterThanOrEqual(0);
    expect(screenY).toBeLessThanOrEqual(520);
  });

  it("clamps the Task 12 hall top approach to camera y zero", () => {
    const camera = computeCameraTransform({
      player: { x: 375, y: 105 },
      viewport: { width: 390, height: 520 },
      bounds: { width: 780, height: 1920 },
      zoom: 1
    });

    expect(camera).toEqual({ x: -180, y: 0, zoom: 1 });
  });

  it("clamps the Task 12 hall bottom approach to the minimum camera y", () => {
    const camera = computeCameraTransform({
      player: { x: 375, y: 1815 },
      viewport: { width: 390, height: 520 },
      bounds: { width: 780, height: 1920 },
      zoom: 1
    });

    expect(camera).toEqual({ x: -180, y: 520 - 1920, zoom: 1 });
  });

  it.each([
    ["top", 105, 0],
    ["bottom", 795, 520 - 900]
  ])("keeps the venue %s portal from exposing outside the map", (_edge, playerY, expectedY) => {
    const camera = computeCameraTransform({
      player: { x: 465, y: playerY },
      viewport: { width: 390, height: 520 },
      bounds: { width: 960, height: 900 },
      zoom: 1
    });

    expect(camera.y).toBe(expectedY);
  });

  it("centers a scaled map axis that is smaller than the viewport", () => {
    const camera = computeCameraTransform({
      player: { x: 30, y: 45 },
      viewport: { width: 390, height: 520 },
      bounds: { width: 240, height: 300 },
      zoom: 1
    });

    expect(camera).toEqual({ x: 75, y: 110, zoom: 1 });
  });

  it("inverts a screen click back into world coordinates", () => {
    const camera = computeCameraTransform({
      player: { x: 315, y: 900 },
      viewport: { width: 390, height: 520 },
      bounds: { width: 780, height: 1920 },
      zoom: 0.8
    });
    const world = screenToWorld({
      client: { x: 180, y: 260 },
      viewportRect: { left: 10, top: 20 },
      camera
    });

    expect(world.x).toBeCloseTo(283.75);
    expect(world.y).toBeCloseTo(875);
  });

  it("uses finite defaults for invalid viewport and zoom values", () => {
    const camera = computeCameraTransform({
      player: { x: 100, y: 200 },
      viewport: { width: Number.NaN, height: 0 },
      bounds: { width: 600, height: 720 },
      zoom: Number.POSITIVE_INFINITY
    });

    expect(camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});
