import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Maximize2, Mic, Navigation, RefreshCw, RotateCcw, ScanLine, Settings2, Volume2, X, ZoomIn, ZoomOut } from "lucide-react";
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
import type { CelebrationCollectibleKind } from "../game/celebrationCollectibles";
import { portalEntryRect, type Point, type WorldZone } from "../game/world";
import { worldAccessibilityLandmarks, type WorldAccessibilityLandmark } from "../game/worldAccessibility";
import {
  destinationVoiceSelectionAvailable,
  listenForDestinationVoiceResult,
  playDestinationVoiceCue,
  speakDestinationVoiceGuidance
} from "../accessibility/destinationVoiceSelection";
import {
  defaultDestinationVoicePreferences,
  loadDestinationVoicePreferences,
  saveDestinationVoicePreferences
} from "../accessibility/destinationVoicePreferences";
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
  collectibleMarkers?: MiniMapCollectibleMarker[];
  companionTrailPoints?: Point[];
  rendezvousPoint?: Point | null;
  onNavigateAccessibilityLandmark?: (landmark: WorldAccessibilityLandmark) => void;
};

export type MiniMapCollectibleMarker = {
  id: string;
  point: Point;
  kind: CelebrationCollectibleKind;
  highlighted?: boolean;
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
  viewTransform?: MiniMapViewTransform;
  collectibleMarkers: MiniMapCollectibleMarker[];
  companionTrailPoints: Point[];
  rendezvousPoint: Point | null;
};

type MiniMapViewTransform = {
  scale: number;
  x: number;
  y: number;
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
  expanded = false,
  viewTransform = { scale: 1, x: 0, y: 0 },
  collectibleMarkers,
  companionTrailPoints,
  rendezvousPoint
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
  const projectedCompanionTrail = companionTrailPoints.map((point) => projectMiniMapPoint(point, zone.bounds, layout));
  const projectedRendezvousPoint = rendezvousPoint
    ? projectMiniMapPoint(rendezvousPoint, zone.bounds, layout)
    : null;

  return (
    <svg
      className={`world-minimap__canvas${expanded ? " world-minimap__canvas--expanded" : ""}`}
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-hidden="true"
      data-view-scale={viewTransform.scale}
      style={{
        transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`
      }}
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
      {projectedCompanionTrail.length > 1 ? (
        <polyline
          data-testid="minimap-companion-trail"
          className="world-minimap__companion-trail"
          points={miniMapPolylinePoints(projectedCompanionTrail)}
        />
      ) : null}
      {projectedRendezvousPoint ? (
        <g
          data-testid="minimap-rendezvous"
          className="world-minimap__rendezvous"
          transform={`translate(${projectedRendezvousPoint.x} ${projectedRendezvousPoint.y})`}
        >
          <circle r={expanded ? 8 : 5.5} />
          <path d="M -3 0 L 3 0 M 0 -3 L 0 3" />
        </g>
      ) : null}
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
      {collectibleMarkers.map((marker) => {
        const point = projectMiniMapPoint(marker.point, zone.bounds, layout);
        return (
          <g
            key={marker.id}
            data-testid="minimap-collectible-marker"
            data-kind={marker.kind}
            data-shape={marker.kind}
            data-highlighted={marker.highlighted || undefined}
            className="world-minimap__collectible-marker"
            transform={`translate(${point.x} ${point.y})`}
          >
            <circle r={marker.highlighted ? expanded ? 8 : 5.5 : expanded ? 5 : 3.5} />
            {marker.kind === "petal" ? (
              <path d="M 0 -3 C 2 -3 2.8 -1.2 1.2 0 C 2.8 1.2 2 3 0 3 C -2 3 -2.8 1.2 -1.2 0 C -2.8 -1.2 -2 -3 0 -3 Z" />
            ) : marker.kind === "ribbon" ? (
              <path d="M -3 -2 L 0 0 L -3 2 Z M 3 -2 L 0 0 L 3 2 Z M -1 -1 L 1 -1 L 1 1 L -1 1 Z" />
            ) : (
              <path d="M 0 -3 L 0.8 -1 L 3 -1 L 1.2 0.5 L 2 3 L 0 1.5 L -2 3 L -1.2 0.5 L -3 -1 L -0.8 -1 Z" />
            )}
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
  journeyDestinationLabels = [],
  collectibleMarkers = [],
  companionTrailPoints = [],
  rendezvousPoint = null,
  onNavigateAccessibilityLandmark
}: WorldMiniMapProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewTransform, setViewTransform] = useState<MiniMapViewTransform>({ scale: 1, x: 0, y: 0 });
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const gesturePointersRef = useRef(new Map<number, Point>());
  const gestureFrameRef = useRef<{ center: Point; distance: number } | null>(null);
  const layout = createMiniMapLayout(zone.bounds);
  const expandedLayout = createMiniMapLayout(zone.bounds, {
    regularLimit: { width: 320, height: 280 },
    tallLimit: { width: 220, height: 340 },
    padding: 10
  });
  const routeStatus = routeActive ? routeContinuing ? "연속 안내" : "이동 중" : "경로 미리보기";
  const accessibilityLandmarks = worldAccessibilityLandmarks(zone, player);
  const [selectedLandmarkIndex, setSelectedLandmarkIndex] = useState(0);
  const [autoScan, setAutoScan] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "selected" | "repeated" | "confirming" | "canceled" | "error">("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voicePreferences, setVoicePreferences] = useState(loadDestinationVoicePreferences);
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const pendingVoiceMoveRef = useRef<number | null>(null);
  const selectedLandmark = accessibilityLandmarks[Math.min(selectedLandmarkIndex, Math.max(0, accessibilityLandmarks.length - 1))] ?? null;

  const cancelPendingVoiceMove = (announce = true) => {
    if (pendingVoiceMoveRef.current !== null) {
      window.clearTimeout(pendingVoiceMoveRef.current);
      pendingVoiceMoveRef.current = null;
    }
    if (announce) {
      setVoiceStatus("canceled");
      playDestinationVoiceCue("cancel");
    }
  };

  const repeatSelectedLandmark = () => {
    if (!selectedLandmark) return;
    speakDestinationVoiceGuidance(
      `${selectedLandmark.label}, ${selectedLandmark.directionLabel}, 약 ${selectedLandmark.tileDistance}칸입니다.`
    );
    setVoiceStatus("repeated");
    playDestinationVoiceCue("selected");
  };

  const startVoiceRecognition = () => {
    if (!selectedLandmark || accessibilityLandmarks.length === 0) return;
    cancelPendingVoiceMove(false);
    setAutoScan(false);
    setVoiceTranscript("");
    setVoiceStatus("listening");
    void listenForDestinationVoiceResult(accessibilityLandmarks.length, undefined, 6_000, voicePreferences).then(({ command, transcript }) => {
      setVoiceTranscript(transcript);
      if (!command) {
        setVoiceStatus("error");
        playDestinationVoiceCue("error");
        return;
      }
      if (command.type === "close") {
        playDestinationVoiceCue("cancel");
        setExpanded(false);
        return;
      }
      if (command.type === "cancel") {
        cancelPendingVoiceMove();
        return;
      }
      if (command.type === "next") {
        setSelectedLandmarkIndex((current) => (current + 1) % accessibilityLandmarks.length);
        setVoiceStatus("selected");
        playDestinationVoiceCue("selected");
        return;
      }
      if (command.type === "repeat") {
        repeatSelectedLandmark();
        return;
      }
      if (command.type === "move") {
        const landmarkToMove = selectedLandmark;
        setVoiceStatus("confirming");
        playDestinationVoiceCue("confirm");
        pendingVoiceMoveRef.current = window.setTimeout(() => {
          pendingVoiceMoveRef.current = null;
          onNavigateAccessibilityLandmark?.(landmarkToMove);
          setExpanded(false);
        }, 2_000);
        return;
      }
      setSelectedLandmarkIndex(command.index);
      setVoiceStatus("selected");
      playDestinationVoiceCue("selected");
    });
  };

  useEffect(() => {
    saveDestinationVoicePreferences(voicePreferences);
  }, [voicePreferences]);

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

  useEffect(() => {
    if (expanded) return;
    cancelPendingVoiceMove(false);
    setViewTransform({ scale: 1, x: 0, y: 0 });
    setAutoScan(false);
    setVoiceStatus("idle");
    setVoiceTranscript("");
    gesturePointersRef.current.clear();
    gestureFrameRef.current = null;
  }, [expanded]);

  useEffect(() => () => cancelPendingVoiceMove(false), []);

  useEffect(() => {
    setSelectedLandmarkIndex(0);
    setAutoScan(false);
    setVoiceStatus("idle");
    setVoiceTranscript("");
  }, [zone.id]);

  useEffect(() => {
    if (!expanded || !autoScan || accessibilityLandmarks.length < 2) return;
    const timer = window.setInterval(() => selectLandmark(1), 1_800);
    const activate = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      const landmark = accessibilityLandmarks[selectedLandmarkIndex % accessibilityLandmarks.length];
      if (landmark && onNavigateAccessibilityLandmark) {
        setAutoScan(false);
        onNavigateAccessibilityLandmark(landmark);
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", activate, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", activate, true);
    };
  }, [accessibilityLandmarks, autoScan, expanded, onNavigateAccessibilityLandmark, selectedLandmarkIndex]);

  const selectLandmark = (delta: number) => {
    if (accessibilityLandmarks.length === 0) return;
    setSelectedLandmarkIndex((current) => (
      (current + delta + accessibilityLandmarks.length) % accessibilityLandmarks.length
    ));
  };

  const updateViewScale = (nextScale: number) => {
    setViewTransform((current) => ({
      ...current,
      scale: Math.min(2.5, Math.max(1, Math.round(nextScale * 100) / 100))
    }));
  };

  const gestureFrame = () => {
    const pointers = [...gesturePointersRef.current.values()];
    if (pointers.length === 0) return null;
    const center = pointers.reduce((sum, point) => ({
      x: sum.x + point.x / pointers.length,
      y: sum.y + point.y / pointers.length
    }), { x: 0, y: 0 });
    const distance = pointers.length > 1
      ? Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y)
      : 0;
    return { center, distance };
  };

  const handleGestureStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gesturePointersRef.current.set(event.pointerId, {
      x: Number.isFinite(event.clientX) ? event.clientX : 0,
      y: Number.isFinite(event.clientY) ? event.clientY : 0
    });
    gestureFrameRef.current = gestureFrame();
  };

  const handleGestureMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gesturePointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    gesturePointersRef.current.set(event.pointerId, {
      x: Number.isFinite(event.clientX) ? event.clientX : 0,
      y: Number.isFinite(event.clientY) ? event.clientY : 0
    });
    const previous = gestureFrameRef.current;
    const next = gestureFrame();
    if (!previous || !next) return;
    setViewTransform((current) => {
      const nextScale = previous.distance > 0 && next.distance > 0
        ? Math.min(2.5, Math.max(1, current.scale * (next.distance / previous.distance)))
        : current.scale;
      const panLimit = 120 * nextScale;
      return {
        scale: Math.round(nextScale * 100) / 100,
        x: Math.max(-panLimit, Math.min(panLimit, current.x + next.center.x - previous.center.x)),
        y: Math.max(-panLimit, Math.min(panLimit, current.y + next.center.y - previous.center.y))
      };
    });
    gestureFrameRef.current = next;
  };

  const handleGestureEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    gesturePointersRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    gestureFrameRef.current = gestureFrame();
  };

  const handleMapWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateViewScale(viewTransform.scale + (event.deltaY < 0 ? 0.25 : -0.25));
  };

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
    routePoints,
    collectibleMarkers,
    companionTrailPoints,
    rendezvousPoint
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
      <section className="sr-only world-minimap__screen-reader-map" aria-label={`${zone.label} 주변 랜드마크`}>
        <h2>{zone.label} 지도 안내</h2>
        <p aria-live="polite">
          {destinationLabel
            ? `현재 목적지는 ${destinationLabel}입니다. ${routeProgressLabel ?? routeStatus}.`
            : "선택된 목적지가 없습니다."}
        </p>
        <ol>
          {accessibilityLandmarks.map((landmark) => (
            <li key={landmark.id}>{landmark.phrase}</li>
          ))}
        </ol>
      </section>

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
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                selectLandmark(-1);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                selectLandmark(1);
              } else if (
                event.target === event.currentTarget
                && (event.key === "Enter" || event.key === " ")
                && selectedLandmark
                && onNavigateAccessibilityLandmark
              ) {
                event.preventDefault();
                onNavigateAccessibilityLandmark(selectedLandmark);
                setExpanded(false);
              }
            }}
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
            <div
              className="world-minimap-expanded__map"
              role="region"
              aria-label="미니맵 시각 탐색"
              onPointerDown={handleGestureStart}
              onPointerMove={handleGestureMove}
              onPointerUp={handleGestureEnd}
              onPointerCancel={handleGestureEnd}
              onWheel={handleMapWheel}
            >
              <div
                className="world-minimap-expanded__map-controls"
                role="group"
                aria-label="미니맵 배율 조절"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label="미니맵 축소"
                  title="미니맵 축소"
                  disabled={viewTransform.scale <= 1}
                  onClick={() => updateViewScale(viewTransform.scale - 0.25)}
                >
                  <ZoomOut aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="미니맵 원위치"
                  title="미니맵 원위치"
                  disabled={viewTransform.scale === 1 && viewTransform.x === 0 && viewTransform.y === 0}
                  onClick={() => setViewTransform({ scale: 1, x: 0, y: 0 })}
                >
                  <RotateCcw aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="미니맵 확대"
                  title="미니맵 확대"
                  disabled={viewTransform.scale >= 2.5}
                  onClick={() => updateViewScale(viewTransform.scale + 0.25)}
                >
                  <ZoomIn aria-hidden="true" />
                </button>
              </div>
              <MiniMapCanvas
                {...canvasProps}
                layout={expandedLayout}
                expanded
                viewTransform={viewTransform}
              />
            </div>
            {selectedLandmark ? (
              <section className="world-minimap-expanded__accessible-nav" aria-label="목적지 순차 탐색">
                <header>
                  <span>목적지 {selectedLandmarkIndex + 1}/{accessibilityLandmarks.length}</span>
                  <strong aria-live="polite">{selectedLandmark.kindLabel} · {selectedLandmark.label}</strong>
                  <small>{selectedLandmark.directionLabel} · 약 {selectedLandmark.tileDistance}칸</small>
                </header>
                <div role="group" aria-label="목적지 순서와 이동">
                  <button type="button" aria-label="이전 목적지" title="이전 목적지" onClick={() => selectLandmark(-1)}>
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={!onNavigateAccessibilityLandmark}
                    onClick={() => {
                      onNavigateAccessibilityLandmark?.(selectedLandmark);
                      setExpanded(false);
                    }}
                  ><Navigation aria-hidden="true" />이곳으로 이동</button>
                  <button type="button" aria-label="다음 목적지" title="다음 목적지" onClick={() => selectLandmark(1)}>
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
                <ol className="world-minimap-expanded__destination-numbers" aria-label="목적지 번호 목록">
                  {accessibilityLandmarks.map((landmark, index) => (
                    <li key={landmark.id}>
                      <button
                        type="button"
                        aria-label={`${index + 1}번 ${landmark.label}`}
                        aria-pressed={index === selectedLandmarkIndex}
                        onClick={() => {
                          setSelectedLandmarkIndex(index);
                          setAutoScan(false);
                          setVoiceStatus("idle");
                        }}
                      ><strong>{index + 1}</strong><span>{landmark.label}</span></button>
                    </li>
                  ))}
                </ol>
                <div className="world-minimap-expanded__switch-controls" role="group" aria-label="스위치와 음성 목적지 선택">
                  <button
                    type="button"
                    aria-pressed={autoScan}
                    onClick={() => {
                      setAutoScan((current) => !current);
                      setVoiceStatus("idle");
                    }}
                  ><ScanLine aria-hidden="true" />{autoScan ? "스캔 중지" : "자동 스캔"}</button>
                  <button
                    type="button"
                    disabled={!destinationVoiceSelectionAvailable() || voiceStatus === "listening" || voiceStatus === "confirming"}
                    onClick={startVoiceRecognition}
                  >{voiceStatus === "error" ? <RefreshCw aria-hidden="true" /> : <Mic aria-hidden="true" />}{voiceStatus === "listening" ? "듣는 중" : voiceStatus === "error" ? "다시 듣기" : "음성 명령"}</button>
                  <button type="button" onClick={repeatSelectedLandmark}>
                    <Volume2 aria-hidden="true" />안내 반복
                  </button>
                  <button
                    type="button"
                    aria-pressed={voiceSettingsOpen}
                    aria-label="음성 명령 설정"
                    title="음성 명령 설정"
                    onClick={() => setVoiceSettingsOpen((current) => !current)}
                  ><Settings2 aria-hidden="true" /></button>
                  {voiceStatus === "confirming" ? (
                    <button type="button" onClick={() => cancelPendingVoiceMove()}>
                      <X aria-hidden="true" />이동 취소
                    </button>
                  ) : null}
                </div>
                <p className="world-minimap-expanded__switch-status" aria-live="polite">
                  {autoScan ? "목적지가 차례로 바뀝니다. 원하는 목적지에서 스위치를 누르세요."
                    : voiceStatus === "listening" ? `번호 또는 ${voicePreferences.nextPhrase}·${voicePreferences.movePhrase}·${voicePreferences.cancelPhrase}·${voicePreferences.repeatPhrase} 중 하나를 말해 주세요.`
                      : voiceStatus === "confirming" ? `${selectedLandmark.label}(으)로 2초 뒤 이동해요. 취소할 수 있어요.`
                        : voiceStatus === "canceled" ? "음성 이동을 취소했어요."
                      : voiceStatus === "selected" ? `${selectedLandmarkIndex + 1}번 목적지를 선택했어요.`
                        : voiceStatus === "repeated" ? `${selectedLandmark.label} 안내를 다시 읽었어요.`
                        : voiceStatus === "error" ? voiceTranscript
                          ? `“${voiceTranscript}”로 들었어요. 명령을 확인한 뒤 다시 말해 주세요.`
                          : "명령을 듣지 못했어요. 다시 듣기나 화살표를 이용해 주세요."
                          : "화살표·번호·자동 스캔·음성 명령 중 편한 방법을 이용하세요."}
                </p>
                {voiceSettingsOpen ? (
                  <fieldset className="world-minimap-expanded__voice-settings">
                    <legend>음성 호출어</legend>
                    {([
                      ["movePhrase", "이동"],
                      ["nextPhrase", "다음"],
                      ["cancelPhrase", "취소"],
                      ["repeatPhrase", "반복"]
                    ] as const).map(([key, label]) => (
                      <label key={key}>
                        <span>{label}</span>
                        <input
                          value={voicePreferences[key]}
                          maxLength={12}
                          onChange={(event) => setVoicePreferences((current) => ({
                            ...current,
                            [key]: event.target.value
                          }))}
                        />
                      </label>
                    ))}
                    <button type="button" onClick={() => setVoicePreferences(defaultDestinationVoicePreferences)}>
                      <RotateCcw aria-hidden="true" />기본값
                    </button>
                  </fieldset>
                ) : null}
              </section>
            ) : null}
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
