import type { Point } from "./world";

export type ViewportSize = { width: number; height: number };
export type CameraTransform = { x: number; y: number; zoom: number };

type CameraInput = {
  player: Point;
  viewport: ViewportSize;
  bounds: ViewportSize;
  zoom: number;
};

type TrackingCameraInput = CameraInput & {
  previous: CameraTransform | null;
  deadZone: ViewportSize;
};

type ScreenToWorldInput = {
  client: Point;
  viewportRect: { left: number; top: number };
  camera: CameraTransform;
};

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function cameraAxis(desired: number, viewportSize: number, mapSize: number, zoom: number): number {
  const scaledMapSize = positiveOr(mapSize, viewportSize / zoom) * zoom;
  const aligned = scaledMapSize <= viewportSize
    ? (viewportSize - scaledMapSize) / 2
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

function trackedAxis(
  player: number,
  previous: number,
  viewportSize: number,
  mapSize: number,
  zoom: number,
  deadZoneSize: number
): number {
  const safeDeadZone = Math.min(viewportSize, positiveOr(deadZoneSize, viewportSize * 0.3));
  const minimum = (viewportSize - safeDeadZone) / 2;
  const maximum = minimum + safeDeadZone;
  const screenPosition = player * zoom + previous;
  const desired = screenPosition < minimum
    ? previous + minimum - screenPosition
    : screenPosition > maximum
      ? previous - (screenPosition - maximum)
      : previous;
  return cameraAxis(desired, viewportSize, mapSize, zoom);
}

export function cameraDeadZone(
  viewport: ViewportSize,
  tracking: "steady" | "responsive" = "steady"
): ViewportSize {
  const width = positiveOr(viewport.width, 390);
  const height = positiveOr(viewport.height, 520);
  if (tracking === "responsive") {
    return {
      width: Math.round(Math.min(88, Math.max(56, width * 0.18))),
      height: Math.round(Math.min(112, Math.max(72, height * 0.18)))
    };
  }
  return {
    width: Math.round(Math.min(132, Math.max(84, width * 0.32))),
    height: Math.round(Math.min(168, Math.max(108, height * 0.28)))
  };
}

export function computeTrackingCameraTransform(input: TrackingCameraInput): CameraTransform {
  const width = positiveOr(input.viewport.width, 390);
  const height = positiveOr(input.viewport.height, 520);
  const zoom = positiveOr(input.zoom, 1);
  const previous = input.previous;
  if (
    !previous
    || !Number.isFinite(previous.x)
    || !Number.isFinite(previous.y)
    || previous.zoom !== zoom
  ) return computeCameraTransform(input);

  return {
    x: trackedAxis(input.player.x, previous.x, width, input.bounds.width, zoom, input.deadZone.width),
    y: trackedAxis(input.player.y, previous.y, height, input.bounds.height, zoom, input.deadZone.height),
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
