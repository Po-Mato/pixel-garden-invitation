import type { Point } from "./world";

export type ViewportSize = { width: number; height: number };
export type CameraTransform = { x: number; y: number; zoom: number };

type CameraInput = {
  player: Point;
  viewport: ViewportSize;
  zoom: number;
};

type ScreenToWorldInput = {
  client: Point;
  viewportRect: { left: number; top: number };
  camera: CameraTransform;
};

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function computeCameraTransform(input: CameraInput): CameraTransform {
  const width = positiveOr(input.viewport.width, 390);
  const height = positiveOr(input.viewport.height, 520);
  const zoom = positiveOr(input.zoom, 1);
  return {
    x: width / 2 - input.player.x * zoom,
    y: height / 2 - input.player.y * zoom,
    zoom
  };
}

export function screenToWorld(input: ScreenToWorldInput): Point {
  const zoom = positiveOr(input.camera.zoom, 1);
  return {
    x: (input.client.x - input.viewportRect.left - input.camera.x) / zoom,
    y: (input.client.y - input.viewportRect.top - input.camera.y) / zoom
  };
}
