import { Accessibility, ArrowRight, Building2, MapPinned } from "lucide-react";
import { journeyAccessibilityGuide } from "../game/journeyAccessibility";
import type { JourneyCheckpoint } from "../game/journeyProgress";

type AccessibleDestinationCueProps = {
  checkpoint: JourneyCheckpoint;
  onOpen: () => void;
};

export function AccessibleDestinationCue({ checkpoint, onOpen }: AccessibleDestinationCueProps) {
  const guide = journeyAccessibilityGuide(checkpoint);
  return (
    <button
      type="button"
      className="world-accessible-destination-cue"
      aria-label={`${checkpoint.label} 접근성 안내 열기`}
      onClick={(event) => { event.stopPropagation(); onOpen(); }}
    >
      <Accessibility aria-hidden="true" />
      <span>
        <small><MapPinned aria-hidden="true" /> {checkpoint.label} 쉬운 도착</small>
        <strong>{guide.landmark}</strong>
        <em><Building2 aria-hidden="true" /> {guide.arrival}</em>
      </span>
      <ArrowRight aria-hidden="true" />
    </button>
  );
}
