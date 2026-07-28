import { Clock3, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { WeddingPhaseExperience } from "../game/weddingPhaseExperience";

type WeddingPhaseAnnouncementProps = {
  experience: WeddingPhaseExperience;
};

export function WeddingPhaseAnnouncement({ experience }: WeddingPhaseAnnouncementProps) {
  const [dismissedPhase, setDismissedPhase] = useState<string | null>(null);
  useEffect(() => setDismissedPhase(null), [experience.phase]);
  if (dismissedPhase === experience.phase || experience.phase === "countdown") return null;
  const Icon = experience.phase === "reception" ? Sparkles : Clock3;
  return (
    <aside className="wedding-phase-announcement" data-phase={experience.phase} role="status">
      <Icon aria-hidden="true" />
      <span><small>{experience.eyebrow}</small><strong>{experience.title}</strong><em>{experience.detail}</em></span>
      <button type="button" aria-label="예식 안내 닫기" onClick={() => setDismissedPhase(experience.phase)}>
        <X aria-hidden="true" />
      </button>
    </aside>
  );
}
