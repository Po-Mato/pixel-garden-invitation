import { ChevronsRight, Timer } from "lucide-react";
import type { WeddingJourneyTiming } from "../game/weddingJourneyTiming";

type Props = {
  timing: WeddingJourneyTiming;
  disabled?: boolean;
  onFastRoute: () => void;
};

export function WeddingJourneyClock({ timing, disabled = false, onFastRoute }: Props) {
  return (
    <div className="wedding-journey-clock" data-phase={timing.phase} data-urgent={timing.urgent || undefined}>
      <Timer aria-hidden="true" />
      <span>
        <strong>{timing.label}</strong>
        <small>{timing.detail}</small>
      </span>
      {timing.showFastCeremonyRoute ? (
        <button type="button" disabled={disabled} onClick={onFastRoute}>
          예식홀 최단 안내
          <ChevronsRight aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
