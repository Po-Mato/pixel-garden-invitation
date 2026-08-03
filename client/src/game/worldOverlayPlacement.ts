import type { CameraTransform, ViewportSize } from "./camera";
import type { Rect } from "./world";

export type WorldOverlayEdge = "left" | "right" | "top" | "bottom";

export type WorldOverlayPlacement = {
  rect: Rect;
  shiftedEdges: WorldOverlayEdge[];
};

type WorldOverlayPlacementInput = {
  rect: Rect;
  camera: CameraTransform;
  viewport: ViewportSize;
  inset?: number;
};

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampedAxis(
  worldPosition: number,
  worldSize: number,
  cameraPosition: number,
  viewportSize: number,
  zoom: number,
  inset: number,
  leadingEdge: WorldOverlayEdge,
  trailingEdge: WorldOverlayEdge
): { position: number; edge: WorldOverlayEdge | null } {
  const screenPosition = worldPosition * zoom + cameraPosition;
  const screenSize = worldSize * zoom;
  const minimum = inset;
  const maximum = Math.max(minimum, viewportSize - inset - screenSize);
  const clampedScreenPosition = Math.min(maximum, Math.max(minimum, screenPosition));
  const delta = clampedScreenPosition - screenPosition;
  if (Math.abs(delta) < 0.5) return { position: worldPosition, edge: null };
  return {
    position: Math.round(worldPosition + delta / zoom),
    edge: delta > 0 ? leadingEdge : trailingEdge
  };
}

export function placeWorldOverlayInsideViewport({
  rect,
  camera,
  viewport,
  inset = 8
}: WorldOverlayPlacementInput): WorldOverlayPlacement {
  const zoom = finitePositive(camera.zoom, 1);
  const width = finitePositive(viewport.width, rect.width * zoom + inset * 2);
  const height = finitePositive(viewport.height, rect.height * zoom + inset * 2);
  const safeInset = Math.max(0, Number.isFinite(inset) ? inset : 8);
  const horizontal = clampedAxis(
    rect.x,
    rect.width,
    camera.x,
    width,
    zoom,
    safeInset,
    "left",
    "right"
  );
  const vertical = clampedAxis(
    rect.y,
    rect.height,
    camera.y,
    height,
    zoom,
    safeInset,
    "top",
    "bottom"
  );

  return {
    rect: { ...rect, x: horizontal.position, y: vertical.position },
    shiftedEdges: [horizontal.edge, vertical.edge].filter((edge): edge is WorldOverlayEdge => edge !== null)
  };
}
