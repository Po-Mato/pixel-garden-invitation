import { PartyPopper, Sparkles } from "lucide-react";

export function WorldCooperativeCelebration({ participantNames }: { participantNames: readonly string[] }) {
  return (
    <div className="world-cooperative-celebration" role="status" aria-label="하객 협동 축하 성공">
      <div aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => <i key={index}><Sparkles /></i>)}
      </div>
      <p><PartyPopper aria-hidden="true" /><strong>함께 만든 축하 꽃비</strong><span>{participantNames.join(" · ")}</span></p>
    </div>
  );
}
