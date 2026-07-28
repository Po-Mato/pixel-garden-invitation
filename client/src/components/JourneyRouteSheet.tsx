import {
  Accessibility,
  ArrowDown,
  ArrowUp,
  Bath,
  Building2,
  Footprints,
  MapPinned,
  Navigation,
  PhoneCall,
  Sparkles,
  X
} from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { JourneyGuidancePreview } from "../game/journeyGuidance";
import { journeyDirectionLabels } from "../game/journeyGuidance";
import type { JourneyCheckpoint, JourneyProgress } from "../game/journeyProgress";
import {
  journeyAccessibilityGuide,
  venueAccessibilityVerification
} from "../game/journeyAccessibility";
import {
  journeyDestinationInstruction,
  summarizeRemainingJourney
} from "../game/journeyRouteSummary";
import { getWorldZone, gardenWorld, type WorldZone } from "../game/world";

type JourneyRouteSheetProps = {
  activeZone: WorldZone;
  checkpoint: JourneyCheckpoint;
  progress: JourneyProgress;
  guidance: JourneyGuidancePreview | null;
  waypoints?: readonly JourneyCheckpoint[];
  selectedWaypointIds?: readonly JourneyCheckpoint["id"][];
  onToggleWaypoint?: (checkpointId: JourneyCheckpoint["id"]) => void;
  onMoveWaypoint?: (checkpointId: JourneyCheckpoint["id"], direction: "up" | "down") => void;
  onOptimizeWaypoints?: () => void;
  estimatedTotalLabel?: string;
  estimatedTileCount?: number;
  estimatedPortalCount?: number;
  stepFreeRouteEnabled?: boolean;
  onStepFreeRouteChange?: (enabled: boolean) => void;
  onClose: () => void;
  onStart: () => void;
  onOpenSimpleDestination?: (checkpoint: JourneyCheckpoint) => void;
};

export function JourneyRouteSheet({
  activeZone,
  checkpoint,
  progress,
  guidance,
  waypoints = [checkpoint],
  selectedWaypointIds = [checkpoint.id],
  onToggleWaypoint,
  onMoveWaypoint,
  onOptimizeWaypoints,
  estimatedTotalLabel,
  estimatedTileCount,
  estimatedPortalCount,
  stepFreeRouteEnabled = false,
  onStepFreeRouteChange,
  onClose,
  onStart,
  onOpenSimpleDestination
}: JourneyRouteSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const summary = summarizeRemainingJourney(progress, activeZone.id);
  const routeZones = summary.nextZonePath.map((zoneId) => getWorldZone(gardenWorld, zoneId));
  const selectedOrder = new Map(selectedWaypointIds.map((id, index) => [id, index]));
  const orderedWaypoints = [
    ...selectedWaypointIds.flatMap((id) => {
      const waypoint = waypoints.find((candidate) => candidate.id === id);
      return waypoint ? [waypoint] : [];
    }),
    ...waypoints.filter((waypoint) => !selectedOrder.has(waypoint.id))
  ];
  const accessibilityGuide = journeyAccessibilityGuide(checkpoint);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="journey-route-sheet__backdrop" role="presentation" onClick={onClose}>
      <section
        className="journey-route-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journey-route-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <Accessibility aria-hidden="true" />
          <span><small>텍스트 경로</small><strong id="journey-route-sheet-title">쉬운 길찾기</strong></span>
          <button ref={closeRef} type="button" aria-label="쉬운 길찾기 닫기" onClick={onClose}><X aria-hidden="true" /></button>
        </header>

        <div className="journey-route-sheet__summary" aria-label="남은 전체 여정 요약">
          <span><strong>{summary.remainingCheckpoints}</strong><small>남은 추억</small></span>
          <span><strong>{summary.zoneTransitions}</strong><small>맵 이동</small></span>
          <span><strong>{estimatedTotalLabel ?? summary.estimatedStages}</strong><small>{estimatedTotalLabel ? "전체 예상" : "예상 단계"}</small></span>
        </div>

        <div className="journey-route-sheet__destination">
          <MapPinned aria-hidden="true" />
          <span><small>다음 목적지</small><strong>{checkpoint.label}</strong></span>
          <em>{guidance?.available && guidance.tileCount > 0
            ? `${guidance.direction ? `${journeyDirectionLabels[guidance.direction]}으로 ` : ""}${guidance.tileCount}타일`
            : checkpoint.zoneId === activeZone.id ? "현재 맵" : "포털 경로 안내"}</em>
        </div>

        <section className="journey-route-sheet__accessible" aria-labelledby="journey-accessible-title">
          <label>
            <span><Accessibility aria-hidden="true" /><strong id="journey-accessible-title">계단 없는 길 우선</strong></span>
            <input
              type="checkbox"
              role="switch"
              checked={stepFreeRouteEnabled}
              disabled={!onStepFreeRouteChange}
              onChange={(event) => onStepFreeRouteChange?.(event.target.checked)}
            />
            <span aria-hidden="true" className="journey-route-sheet__switch-track" />
          </label>
          {stepFreeRouteEnabled ? (
            <>
              <ul>
                <li><Footprints aria-hidden="true" /><span><strong>계단 없는 이동</strong><small>{accessibilityGuide.stepFree}</small></span></li>
                <li><Building2 aria-hidden="true" /><span><strong>엘리베이터</strong><small>{accessibilityGuide.elevator}</small></span></li>
                <li><Bath aria-hidden="true" /><span><strong>접근 가능한 화장실</strong><small>{accessibilityGuide.restroom}</small></span></li>
              </ul>
              <div className="journey-route-sheet__venue-check">
                <span>
                  <strong>{venueAccessibilityVerification.checkedLabel}</strong>
                  <small>{venueAccessibilityVerification.confirmed}</small>
                  <small>{venueAccessibilityVerification.needsConfirmation}</small>
                </span>
                <a href={venueAccessibilityVerification.phoneHref} aria-label={`${venueAccessibilityVerification.phone} 편의시설 전화 확인`}>
                  <PhoneCall aria-hidden="true" /> 전화 확인
                </a>
              </div>
            </>
          ) : null}
        </section>

        <fieldset className="journey-route-sheet__waypoints">
          <legend>경유지 계획</legend>
          <div className="journey-route-sheet__waypoint-tools">
            <p>
              {typeof estimatedTileCount === "number" && typeof estimatedPortalCount === "number"
                ? `현재 위치 기준 ${estimatedTileCount}타일 · 포털 ${estimatedPortalCount}회`
                : "방문할 목적지를 선택하면 예식 여정 순서로 안내합니다."}
            </p>
            {onOptimizeWaypoints ? (
              <button type="button" onClick={onOptimizeWaypoints} disabled={selectedWaypointIds.length < 2}>
                <Sparkles aria-hidden="true" /> 빠른 순서
              </button>
            ) : null}
          </div>
          {orderedWaypoints.map((waypoint) => {
            const selected = selectedWaypointIds.includes(waypoint.id);
            const order = selectedOrder.get(waypoint.id);
            return (
              <div className="journey-route-sheet__waypoint" key={waypoint.id} data-selected={selected || undefined}>
                <input
                  type="checkbox"
                  aria-label={`${waypoint.label} 경유지 ${selected ? "제외" : "추가"}`}
                  checked={selected}
                  disabled={!onToggleWaypoint || (selected && selectedWaypointIds.length === 1)}
                  onChange={() => onToggleWaypoint?.(waypoint.id)}
                />
                <b>{order === undefined ? "+" : order + 1}</b>
                <span><strong>{waypoint.label}</strong><small>{waypoint.detail}</small></span>
                <em>{waypoint.zoneId === activeZone.id ? "현재 맵" : getWorldZone(gardenWorld, waypoint.zoneId).label}</em>
                {selected && onMoveWaypoint ? (
                  <span className="journey-route-sheet__waypoint-order" aria-label={`${waypoint.label} 순서 변경`}>
                    <button type="button" aria-label={`${waypoint.label} 앞 순서로`} disabled={order === 0} onClick={() => onMoveWaypoint(waypoint.id, "up")}><ArrowUp aria-hidden="true" /></button>
                    <button type="button" aria-label={`${waypoint.label} 뒤 순서로`} disabled={order === selectedWaypointIds.length - 1} onClick={() => onMoveWaypoint(waypoint.id, "down")}><ArrowDown aria-hidden="true" /></button>
                  </span>
                ) : null}
              </div>
            );
          })}
        </fieldset>

        <ol aria-label={`${checkpoint.label}까지 이동 순서`}>
          {routeZones.map((zone, index) => (
            <li key={zone.id} aria-current={index === 0 ? "location" : undefined}>
              <b>{index + 1}</b>
              <span><strong>{zone.label}</strong><small>{index === 0 ? "현재 위치" : "포털을 지나 이동"}</small></span>
            </li>
          ))}
          <li>
            <b>{routeZones.length + 1}</b>
            <span><strong>{checkpoint.label}</strong><small>{journeyDestinationInstruction(checkpoint)}</small></span>
          </li>
        </ol>

        {onOpenSimpleDestination ? (
          <button
            type="button"
            className="journey-route-sheet__simple-destination"
            onClick={() => onOpenSimpleDestination(checkpoint)}
          >
            <Accessibility aria-hidden="true" /> 간편 초대장에서 이 목적지 보기
          </button>
        ) : null}

        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>계속 둘러보기</button>
          <button type="button" className="primary-button" aria-label="길 안내 시작" onClick={onStart}>
            <Navigation aria-hidden="true" /> {selectedWaypointIds.length > 1 ? `${selectedWaypointIds.length}곳 안내 시작` : "길 안내 시작"}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
