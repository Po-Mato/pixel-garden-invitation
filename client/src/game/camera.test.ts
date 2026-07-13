import { describe, expect, it } from "vitest";
import { computeCameraTransform, screenToWorld } from "./camera";

describe("tracking camera", () => {
  it("projects the player onto the exact viewport center", () => {
    const camera = computeCameraTransform({
      player: { x: 315, y: 1200 },
      viewport: { width: 390, height: 520 },
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
      zoom: 0.8
    });

    expect(525 * camera.zoom + camera.x).toBeCloseTo(160);
    expect(735 * camera.zoom + camera.y).toBeCloseTo(200);
  });

  it("inverts a screen click back into world coordinates", () => {
    const camera = computeCameraTransform({
      player: { x: 315, y: 900 },
      viewport: { width: 390, height: 520 },
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
      zoom: Number.POSITIVE_INFINITY
    });

    expect(camera).toEqual({ x: 95, y: 60, zoom: 1 });
  });
});
