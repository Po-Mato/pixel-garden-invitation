import type { Direction } from "@wedding-game/shared";
import type { CameraTransform, ViewportSize } from "../game/camera";
import {
  computeMiniMapViewportRect,
  createMiniMapLayout,
  projectMiniMapPoint,
  projectMiniMapRect
} from "../game/minimap";
import type { Point, WorldZone } from "../game/world";

type WorldMiniMapProps = {
  zone: WorldZone;
  player: Point;
  direction: Direction;
  camera: CameraTransform;
  viewport: ViewportSize;
  targetPortalId: string | null;
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
  targetPortalId
}: WorldMiniMapProps) {
  const layout = createMiniMapLayout(zone.bounds);
  const playerPoint = projectMiniMapPoint(player, zone.bounds, layout);
  const viewportRect = computeMiniMapViewportRect({ bounds: zone.bounds, layout, viewport, camera });
  const directionVector = directionVectors[direction];

  return (
    <aside
      className="world-minimap"
      aria-label="현재 구역 미니맵"
      data-theme={zone.theme}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="world-minimap__title">{zone.label}</span>
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
        {zone.portals.map((portal) => (
          <rect
            key={portal.id}
            data-testid="minimap-portal"
            className={`world-minimap__portal${portal.id === targetPortalId ? " world-minimap__portal--target" : ""}`}
            {...projectMiniMapRect(portal, zone.bounds, layout)}
          />
        ))}
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
