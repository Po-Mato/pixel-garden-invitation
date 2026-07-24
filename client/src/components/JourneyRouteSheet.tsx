import { Accessibility, MapPinned, Navigation, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { JourneyGuidancePreview } from "../game/journeyGuidance";
import { journeyDirectionLabels } from "../game/journeyGuidance";
import type { JourneyCheckpoint, JourneyProgress } from "../game/journeyProgress";
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
  onClose: () => void;
  onStart: () => void;
};

export function JourneyRouteSheet({ activeZone, checkpoint, progress, guidance, onClose, onStart }: JourneyRouteSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const summary = summarizeRemainingJourney(progress, activeZone.id);
  const routeZones = summary.nextZonePath.map((zoneId) => getWorldZone(gardenWorld, zoneId));

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
          <span><strong>{summary.estimatedStages}</strong><small>예상 단계</small></span>
        </div>

        <div className="journey-route-sheet__destination">
          <MapPinned aria-hidden="true" />
          <span><small>다음 목적지</small><strong>{checkpoint.label}</strong></span>
          <em>{guidance?.available && guidance.tileCount > 0
            ? `${guidance.direction ? `${journeyDirectionLabels[guidance.direction]}으로 ` : ""}${guidance.tileCount}타일`
            : checkpoint.zoneId === activeZone.id ? "현재 맵" : "포털 경로 안내"}</em>
        </div>

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

        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>계속 둘러보기</button>
          <button type="button" className="primary-button" onClick={onStart}>
            <Navigation aria-hidden="true" /> 길 안내 시작
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
