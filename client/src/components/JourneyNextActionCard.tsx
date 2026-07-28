import { ArrowRight, CircleCheck } from "lucide-react";
import type { JourneyArrivalAction } from "../game/journeyArrivalAction";

type Props = {
  action: JourneyArrivalAction;
  disabled?: boolean;
  onContinue: () => void;
  onDismiss: () => void;
};

export function JourneyNextActionCard({ action, disabled = false, onContinue, onDismiss }: Props) {
  return (
    <aside
      className="journey-next-action-card"
      aria-label="도착 후 다음 행동"
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className="journey-next-action-card__dismiss" aria-label="다음 행동 안내 닫기" onClick={onDismiss}>×</button>
      <CircleCheck aria-hidden="true" />
      <span>
        <small>{action.completedLabel} 완료</small>
        <strong>다음 · {action.nextLabel}</strong>
        <em>{action.detail}</em>
      </span>
      <button type="button" className="journey-next-action-card__continue" disabled={disabled} onClick={onContinue}>
        이어서 안내
        <ArrowRight aria-hidden="true" />
      </button>
    </aside>
  );
}
