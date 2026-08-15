import type { Point } from "./world";

export type ViewportSize = { width: number; height: number };
export type CameraTransform = { x: number; y: number; zoom: number };
export type CameraEdge = "left" | "right" | "top" | "bottom";

type CameraInput = {
  player: Point;
  viewport: ViewportSize;
  bounds: ViewportSize;
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

export function snapCameraViewport(viewport: ViewportSize): ViewportSize {
  return {
    width: Math.max(1, Math.round(positiveOr(viewport.width, 390))),
    height: Math.max(1, Math.round(positiveOr(viewport.height, 520)))
  };
}

function cameraAxis(desired: number, viewportSize: number, mapSize: number, zoom: number): number {
  const scaledMapSize = positiveOr(mapSize, viewportSize / zoom) * zoom;
  const aligned = scaledMapSize <= viewportSize
    ? Math.min(viewportSize - scaledMapSize, Math.max(0, desired))
    : Math.min(0, Math.max(viewportSize - scaledMapSize, desired));
  return Math.round(aligned);
}

export function computeCameraTransform(input: CameraInput): CameraTransform {
  const width = positiveOr(input.viewport.width, 390);
  const height = positiveOr(input.viewport.height, 520);
  const zoom = positiveOr(input.zoom, 1);
  const desiredX = width / 2 - input.player.x * zoom;
  const desiredY = height / 2 - input.player.y * zoom;
  return {
    x: cameraAxis(desiredX, width, input.bounds.width, zoom),
    y: cameraAxis(desiredY, height, input.bounds.height, zoom),
    zoom
  };
}

export function cameraTransformCss(camera: CameraTransform): string {
  return `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`;
}

export function cameraClampedEdges(
  camera: CameraTransform,
  viewport: ViewportSize,
  bounds: ViewportSize
): CameraEdge[] {
  const width = positiveOr(viewport.width, 390);
  const height = positiveOr(viewport.height, 520);
  const zoom = positiveOr(camera.zoom, 1);
  const scaledWidth = positiveOr(bounds.width, width / zoom) * zoom;
  const scaledHeight = positiveOr(bounds.height, height / zoom) * zoom;
  const epsilon = 0.5;
  const edges: CameraEdge[] = [];

  if (scaledWidth > width + epsilon) {
    if (camera.x >= -epsilon) edges.push("left");
    if (camera.x <= width - scaledWidth + epsilon) edges.push("right");
  }
  if (scaledHeight > height + epsilon) {
    if (camera.y >= -epsilon) edges.push("top");
    if (camera.y <= height - scaledHeight + epsilon) edges.push("bottom");
  }

  return edges;
}

export function screenToWorld(input: ScreenToWorldInput): Point {
  const zoom = positiveOr(input.camera.zoom, 1);
  return {
    x: (input.client.x - input.viewportRect.left - input.camera.x) / zoom,
    y: (input.client.y - input.viewportRect.top - input.camera.y) / zoom
  };
}
