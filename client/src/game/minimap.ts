import type { CameraTransform, ViewportSize } from "./camera";
import type { Point, Rect } from "./world";

export type MiniMapLayout = {
  width: number;
  height: number;
  padding: number;
  scale: number;
  content: Rect;
};

type MiniMapViewportInput = {
  bounds: Rect;
  layout: MiniMapLayout;
  viewport: ViewportSize;
  camera: CameraTransform;
};

const regularLimit = { width: 96, height: 96 };
const tallLimit = { width: 72, height: 120 };
const defaultPadding = 4;

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function createMiniMapLayout(bounds: Rect): MiniMapLayout {
  const boundsWidth = positiveOr(bounds.width, 1);
  const boundsHeight = positiveOr(bounds.height, 1);
  const limit = boundsHeight / boundsWidth >= 1.6 ? tallLimit : regularLimit;
  const availableWidth = limit.width - defaultPadding * 2;
  const availableHeight = limit.height - defaultPadding * 2;
  const scale = Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight);
  const content = {
    x: defaultPadding,
    y: defaultPadding,
    width: boundsWidth * scale,
    height: boundsHeight * scale
  };

  return {
    width: content.width + defaultPadding * 2,
    height: content.height + defaultPadding * 2,
    padding: defaultPadding,
    scale,
    content
  };
}

export function projectMiniMapPoint(point: Point, bounds: Rect, layout: MiniMapLayout): Point {
  return {
    x: layout.content.x + (point.x - bounds.x) * layout.scale,
    y: layout.content.y + (point.y - bounds.y) * layout.scale
  };
}

export function projectMiniMapRect(rect: Rect, bounds: Rect, layout: MiniMapLayout): Rect {
  const origin = projectMiniMapPoint(rect, bounds, layout);
  return {
    ...origin,
    width: rect.width * layout.scale,
    height: rect.height * layout.scale
  };
}

export function computeMiniMapViewportRect(input: MiniMapViewportInput): Rect {
  const zoom = positiveOr(input.camera.zoom, 1);
  const worldLeft = Math.max(input.bounds.x, -input.camera.x / zoom);
  const worldTop = Math.max(input.bounds.y, -input.camera.y / zoom);
  const worldRight = Math.min(
    input.bounds.x + input.bounds.width,
    (input.viewport.width - input.camera.x) / zoom
  );
  const worldBottom = Math.min(
    input.bounds.y + input.bounds.height,
    (input.viewport.height - input.camera.y) / zoom
  );

  return projectMiniMapRect({
    x: worldLeft,
    y: worldTop,
    width: Math.max(0, worldRight - worldLeft),
    height: Math.max(0, worldBottom - worldTop)
  }, input.bounds, input.layout);
}
