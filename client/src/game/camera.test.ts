import { describe, expect, it } from "vitest";
import {
  cameraClampedEdges,
  cameraTransformCss,
  computeCameraTransform,
  screenToWorld,
  snapCameraViewport
} from "./camera";

describe("tracking camera", () => {
  it("snaps fractional layout measurements to a stable CSS-pixel viewport", () => {
    expect(snapCameraViewport({ width: 389.6, height: 519.51 })).toEqual({ width: 390, height: 520 });
    expect(snapCameraViewport({ width: 390.4, height: 520.49 })).toEqual({ width: 390, height: 520 });
    expect(snapCameraViewport({ width: Number.NaN, height: 0 })).toEqual({ width: 390, height: 520 });
  });

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

  it("uses the free space around a smaller map to keep the player near center", () => {
    const camera = computeCameraTransform({
      player: { x: 30, y: 45 },
      viewport: { width: 390, height: 520 },
      bounds: { width: 240, height: 300 },
      zoom: 1
    });

    expect(camera).toEqual({ x: 150, y: 215, zoom: 1 });
    expect(30 + camera.x).toBe(180);
    expect(45 + camera.y).toBe(260);
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

  it("aligns an odd-sized viewport camera to whole CSS pixels", () => {
    const camera = computeCameraTransform({
      player: { x: 315, y: 900 },
      viewport: { width: 391, height: 521 },
      bounds: { width: 780, height: 1920 },
      zoom: 1
    });

    expect(camera).toEqual({ x: -119, y: -639, zoom: 1 });
    expect(Number.isInteger(camera.x)).toBe(true);
    expect(Number.isInteger(camera.y)).toBe(true);
  });

  it("recenters after every interior grid step instead of leaving a dead zone", () => {
    for (const x of [315, 345, 375, 405]) {
      const camera = computeCameraTransform({
        player: { x, y: 1200 },
        viewport: { width: 390, height: 520 },
        bounds: { width: 780, height: 1920 },
        zoom: 1
      });

      expect(x + camera.x).toBe(195);
      expect(1200 + camera.y).toBe(260);
    }
  });

  it("serializes the snapped camera without fractional transform drift", () => {
    expect(cameraTransformCss({ x: -120, y: -940, zoom: 1 }))
      .toBe("translate3d(-120px, -940px, 0) scale(1)");
  });

  it("reports only the map edges that prevent exact player centering", () => {
    expect(cameraClampedEdges(
      { x: 0, y: -940, zoom: 1 },
      { width: 390, height: 520 },
      { width: 780, height: 1920 }
    )).toEqual(["left"]);
    expect(cameraClampedEdges(
      { x: -390, y: -1400, zoom: 1 },
      { width: 390, height: 520 },
      { width: 780, height: 1920 }
    )).toEqual(["right", "bottom"]);
    expect(cameraClampedEdges(
      { x: -120, y: -940, zoom: 1 },
      { width: 390, height: 520 },
      { width: 780, height: 1920 }
    )).toEqual([]);
  });

  it("does not mark an axis whose map already fits inside the viewport", () => {
    expect(cameraClampedEdges(
      { x: 75, y: 110, zoom: 1 },
      { width: 390, height: 520 },
      { width: 240, height: 300 }
    )).toEqual([]);
  });
});
