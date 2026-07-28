import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import type { Direction } from "@wedding-game/shared";
import type { CameraTransform, ViewportSize } from "../game/camera";
import {
  computeMiniMapViewportRect,
  createMiniMapLayout,
  projectMiniMapPoint,
  projectMiniMapRect,
  type MiniMapLayout
} from "../game/minimap";
import { segmentJourneyRouteBySurface } from "../game/journeyRouteVisual";
import type { RouteRecalculationResult } from "../game/routeDeviation";
import { portalEntryRect, type Point, type WorldZone } from "../game/world";
import "../mini-map-expanded.css";

export type MiniMapRouteKind = "preview" | "journey" | "selected";

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
  routeActive?: boolean;
  routeContinuing?: boolean;
  routeKind?: MiniMapRouteKind;
  routePoints?: Point[];
  routeProgressLabel?: string | null;
  routeNotice?: RouteRecalculationResult | null;
  journeyStops?: MiniMapJourneyStop[];
  journeyDestinationLabels?: string[];
};

export type JourneyMiniMapMarker = {
  id: string;
  point: Point;
  completed: boolean;
  recommended?: boolean;
};

export type MiniMapJourneyStop = {
  id: string;
  zoneLabel: string;
  portalLabel: string | null;
  current?: boolean;
};

type MiniMapCanvasProps = {
  zone: WorldZone;
  player: Point;
  direction: Direction;
  camera: CameraTransform;
  viewport: ViewportSize;
  targetPortalId: string | null;
  journeyMarkers: JourneyMiniMapMarker[];
  destinationPoint: Point | null;
  routeActive: boolean;
  routeKind: MiniMapRouteKind;
  routePoints: Point[];
  layout: MiniMapLayout;
  expanded?: boolean;
};

const directionVectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const miniMapPolylinePoints = (points: Point[]) => points.map((point) => `${point.x},${point.y}`).join(" ");

function MiniMapCanvas({
  zone,
  player,
  direction,
  camera,
  viewport,
  targetPortalId,
  journeyMarkers,
  destinationPoint,
  routeActive,
  routeKind,
  routePoints,
  layout,
  expanded = false
}: MiniMapCanvasProps) {
  const playerPoint = projectMiniMapPoint(player, zone.bounds, layout);
  const viewportRect = computeMiniMapViewportRect({ bounds: zone.bounds, layout, viewport, camera });
  const directionVector = directionVectors[direction];
  const recommendedMarker = journeyMarkers.find((marker) => marker.recommended);
  const routeDestination = destinationPoint ?? recommendedMarker?.point ?? null;
  const effectiveRoutePoints = routePoints.length > 1
    ? routePoints
    : routeDestination
      ? [player, routeDestination]
      : [];
  const routeSegments = segmentJourneyRouteBySurface(zone, effectiveRoutePoints);

  return (
    <svg
      className={`world-minimap__canvas${expanded ? " world-minimap__canvas--expanded" : ""}`}
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-hidden="true"
    >
      <rect data-testid="minimap-map-boundary" className="world-minimap__boundary" {...layout.content} />
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
      {routeSegments.length > 0 ? (
        <g
          data-testid="minimap-destination-route"
          className="world-minimap__route"
          data-route-active={routeActive}
          data-route-kind={routeKind}
        >
          {routeSegments.map((segment, index) => {
            const points = segment.points.map((point) => projectMiniMapPoint(point, zone.bounds, layout));
            return (
              <g key={`${segment.surface}-${index}`} data-surface={segment.surface}>
                <polyline className="world-minimap__route-outline" points={miniMapPolylinePoints(points)} />
                <polyline className="world-minimap__route-path" points={miniMapPolylinePoints(points)} />
              </g>
            );
          })}
        </g>
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
            <circle r={expanded ? 6 : 4.5} />
            {marker.completed
              ? <path d="M -2 0 L -0.4 2 L 2.7 -2" />
              : <path d="M 0 -2.5 L 0 2.5 M -2.5 0 L 2.5 0" />}
          </g>
        );
      })}
      <rect data-testid="minimap-viewport" className="world-minimap__viewport" {...viewportRect} />
      <g data-testid="minimap-player" className="world-minimap__player" data-direction={direction}>
        <circle cx={playerPoint.x} cy={playerPoint.y} r={expanded ? 5 : 3} />
        <line
          x1={playerPoint.x}
          y1={playerPoint.y}
          x2={playerPoint.x + directionVector.x * (expanded ? 10 : 6)}
          y2={playerPoint.y + directionVector.y * (expanded ? 10 : 6)}
        />
      </g>
    </svg>
  );
}

export function WorldMiniMap({
  zone,
  player,
  direction,
  camera,
  viewport,
  targetPortalId,
  journeyMarkers = [],
  destinationLabel = null,
  destinationPoint = null,
  routeActive = false,
  routeContinuing = false,
  routeKind = "preview",
  routePoints = [],
  routeProgressLabel = null,
  routeNotice = null,
  journeyStops = [],
  journeyDestinationLabels = []
}: WorldMiniMapProps) {
  const [expanded, setExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const layout = createMiniMapLayout(zone.bounds);
  const expandedLayout = createMiniMapLayout(zone.bounds, {
    regularLimit: { width: 320, height: 280 },
    tallLimit: { width: 220, height: 340 },
    padding: 10
  });
  const routeStatus = routeActive ? routeContinuing ? "연속 안내" : "이동 중" : "경로 미리보기";

  useEffect(() => {
    if (!expanded) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      expandButtonRef.current?.focus();
    };
  }, [expanded]);

  const canvasProps = {
    zone,
    player,
    direction,
    camera,
    viewport,
    targetPortalId,
    journeyMarkers,
    destinationPoint,
    routeActive,
    routeKind,
    routePoints
  };

  return (
    <aside
      className="world-minimap"
      aria-label="현재 구역 미니맵"
      data-theme={zone.theme}
      data-route-continuing={routeContinuing || undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="world-minimap__title-row">
        <span className="world-minimap__title">{zone.label}</span>
        <button
          ref={expandButtonRef}
          type="button"
          className="world-minimap__expand"
          aria-label="미니맵 확대 보기"
          title="미니맵 확대 보기"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded(true);
          }}
        >
          <Maximize2 aria-hidden="true" />
        </button>
      </div>
      {destinationLabel ? <span className="world-minimap__destination-label">목적지 · {destinationLabel}</span> : null}
      {routeProgressLabel ? (
        <span
          className="world-minimap__route-progress"
          data-testid="minimap-route-progress"
          data-route-kind={routeKind}
        >
          {routeStatus} · {routeProgressLabel}
        </span>
      ) : null}
      {routeNotice ? (
        <span className="world-minimap__reroute" data-kind={routeNotice.kind}>
          {routeNotice.notice}
        </span>
      ) : null}
      <MiniMapCanvas {...canvasProps} layout={layout} />

      {expanded ? createPortal(
        <div
          className="world-minimap-expanded"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded(false);
          }}
        >
          <section
            className="world-minimap-expanded__panel"
            role="dialog"
            aria-modal="true"
            aria-label="현재 경로 전체 미리보기"
            data-theme={zone.theme}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="world-minimap-expanded__header">
              <div>
                <span>현재 구역</span>
                <strong>{zone.label}</strong>
                {destinationLabel ? <small>목적지 · {destinationLabel}</small> : null}
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="미니맵 닫기"
                title="미니맵 닫기"
                onClick={() => setExpanded(false)}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="world-minimap-expanded__map">
              <MiniMapCanvas {...canvasProps} layout={expandedLayout} expanded />
            </div>
            {journeyStops.length > 0 ? (
              <section className="world-minimap-expanded__journey" aria-label="남은 전체 여정">
                <header>
                  <strong>남은 전체 여정</strong>
                  <span>포털 {Math.max(0, journeyStops.length - 1)}회</span>
                </header>
                <ol>
                  {journeyStops.map((stop, index) => (
                    <li key={stop.id} data-current={stop.current || undefined}>
                      <span className="world-minimap-expanded__journey-index">{index + 1}</span>
                      <div>
                        <strong>{stop.zoneLabel}</strong>
                        {stop.portalLabel ? <small>{stop.portalLabel} 통과</small> : <small>여정 목적지</small>}
                      </div>
                    </li>
                  ))}
                </ol>
                {journeyDestinationLabels.length > 0 ? (
                  <div className="world-minimap-expanded__destinations" aria-label="남은 방문 목적지">
                    {journeyDestinationLabels.map((label, index) => (
                      <span key={`${label}-${index}`}>{label}</span>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
            <footer className="world-minimap-expanded__footer">
              <span data-route-kind={routeKind}>{routeStatus}</span>
              <div>
                <strong>{routeProgressLabel ?? "현재 위치 확인"}</strong>
                {routeNotice ? <small data-kind={routeNotice.kind}>{routeNotice.notice}</small> : null}
              </div>
            </footer>
          </section>
        </div>,
        document.body
      ) : null}
    </aside>
  );
}
