import type { Direction } from "@wedding-game/shared";
import type { CameraTransform, ViewportSize } from "../game/camera";
import {
  computeMiniMapViewportRect,
  createMiniMapLayout,
  projectMiniMapPoint,
  projectMiniMapRect
} from "../game/minimap";
import { portalEntryRect, type Point, type WorldZone } from "../game/world";

type WorldMiniMapProps = {
  zone: WorldZone;
  player: Point;
  direction: Direction;
  camera: CameraTransform;
  viewport: ViewportSize;
  targetPortalId: string | null;
  journeyMarkers?: JourneyMiniMapMarker[];
  destinationLabel?: string | null;
  destinationPoint?: Point | null;
};

export type JourneyMiniMapMarker = {
  id: string;
  point: Point;
  completed: boolean;
  recommended?: boolean;
};

const directionVectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export function WorldMiniMap({
  zone,
  player,
  direction,
  camera,
  viewport,
  targetPortalId,
  journeyMarkers = [],
  destinationLabel = null,
  destinationPoint = null
}: WorldMiniMapProps) {
  const layout = createMiniMapLayout(zone.bounds);
  const playerPoint = projectMiniMapPoint(player, zone.bounds, layout);
  const viewportRect = computeMiniMapViewportRect({ bounds: zone.bounds, layout, viewport, camera });
  const directionVector = directionVectors[direction];
  const recommendedMarker = journeyMarkers.find((marker) => marker.recommended);
  const recommendedPoint = destinationPoint
    ? projectMiniMapPoint(destinationPoint, zone.bounds, layout)
    : recommendedMarker
      ? projectMiniMapPoint(recommendedMarker.point, zone.bounds, layout)
    : null;

  return (
    <aside
      className="world-minimap"
      aria-label="현재 구역 미니맵"
      data-theme={zone.theme}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="world-minimap__title">{zone.label}</span>
      {destinationLabel ? <span className="world-minimap__destination-label">목적지 · {destinationLabel}</span> : null}
      <svg
        className="world-minimap__canvas"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        aria-hidden="true"
      >
        <rect
          data-testid="minimap-map-boundary"
          className="world-minimap__boundary"
          {...layout.content}
        />
        {zone.paths.map((path) => (
          <rect
            key={path.id}
            data-testid="minimap-path"
            className={`world-minimap__path world-minimap__path--${path.kind}`}
            {...projectMiniMapRect(path, zone.bounds, layout)}
          />
        ))}
        {zone.blocked.map((obstacle, index) => (
          <rect
            key={`${obstacle.x}-${obstacle.y}-${index}`}
            data-testid="minimap-obstacle"
            className="world-minimap__obstacle"
            {...projectMiniMapRect(obstacle, zone.bounds, layout)}
          />
        ))}
        {zone.spots.map((spot) => (
          <rect
            key={spot.id}
            data-testid="minimap-spot"
            className="world-minimap__spot"
            {...projectMiniMapRect(spot, zone.bounds, layout)}
          />
        ))}
        {zone.photoSpots.map((photoSpot) => (
          <rect
            key={photoSpot.id}
            data-testid="minimap-photo-spot"
            className="world-minimap__photo-spot"
            {...projectMiniMapRect(photoSpot, zone.bounds, layout)}
          />
        ))}
        {zone.portals.map((portal) => (
          <rect
            key={portal.id}
            data-testid="minimap-portal"
            className={`world-minimap__portal${portal.id === targetPortalId ? " world-minimap__portal--target" : ""}`}
            {...projectMiniMapRect(portalEntryRect(portal), zone.bounds, layout)}
          />
        ))}
        {recommendedPoint ? (
          <line
            data-testid="minimap-destination-route"
            className="world-minimap__destination-route"
            x1={playerPoint.x}
            y1={playerPoint.y}
            x2={recommendedPoint.x}
            y2={recommendedPoint.y}
          />
        ) : null}
        {journeyMarkers.map((marker) => {
          const point = projectMiniMapPoint(marker.point, zone.bounds, layout);
          return (
            <g
              key={marker.id}
              data-testid="minimap-journey-marker"
              data-checkpoint-id={marker.id}
              className={`world-minimap__journey-marker${marker.completed ? " world-minimap__journey-marker--complete" : ""}${marker.recommended ? " world-minimap__journey-marker--recommended" : ""}`}
              transform={`translate(${point.x} ${point.y})`}
            >
              <circle r="4.5" />
              {marker.completed
                ? <path d="M -2 0 L -0.4 2 L 2.7 -2" />
                : <path d="M 0 -2.5 L 0 2.5 M -2.5 0 L 2.5 0" />}
            </g>
          );
        })}
        <rect
          data-testid="minimap-viewport"
          className="world-minimap__viewport"
          {...viewportRect}
        />
        <g
          data-testid="minimap-player"
          className="world-minimap__player"
          data-direction={direction}
        >
          <circle cx={playerPoint.x} cy={playerPoint.y} r="3" />
          <line
            x1={playerPoint.x}
            y1={playerPoint.y}
            x2={playerPoint.x + directionVector.x * 6}
            y2={playerPoint.y + directionVector.y * 6}
          />
        </g>
      </svg>
    </aside>
  );
}
