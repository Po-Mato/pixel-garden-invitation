import { useEffect } from "react";
import { Flower2, Gift, Sparkles, X } from "lucide-react";
import type { CelebrationMilestone } from "../game/celebrationReward";

const milestoneIcons = {
  petal: Flower2,
  ribbon: Gift,
  star: Sparkles
} as const;

export function CelebrationMilestoneNotice({
  milestone,
  onClose
}: {
  milestone: CelebrationMilestone;
  onClose: () => void;
}) {
  const Icon = milestoneIcons[milestone.kind];

  useEffect(() => {
    const timer = window.setTimeout(onClose, 4_200);
    return () => window.clearTimeout(timer);
  }, [milestone.id, onClose]);

  return (
    <aside
      className="celebration-milestone-notice"
      data-kind={milestone.kind}
      data-type={milestone.type}
      role="status"
      aria-live="polite"
    >
      <div aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => <Icon key={index} />)}
      </div>
      <Icon aria-hidden="true" />
      <p>
        <small>{milestone.type === "zone" ? "ZONE COMPLETE" : "COLLECTION REWARD"}</small>
        <strong>{milestone.title}</strong>
        <span>{milestone.detail}</span>
      </p>
      <button type="button" aria-label="수집 보상 안내 닫기" onClick={onClose}>
        <X aria-hidden="true" />
      </button>
    </aside>
  );
}
