import { Camera, PartyPopper, Sparkles } from "lucide-react";
import type { CooperativeCelebrationTier } from "../game/cooperativeCelebration";

const tierLabel: Record<CooperativeCelebrationTier, string> = {
  duet: "두 사람의 꽃잎 인사",
  chorus: "하객 축하 합창",
  festival: "웨딩 가든 피날레"
};

export function WorldCooperativeCelebration({
  participantNames,
  tier,
  onOpenGroupPhoto
}: {
  participantNames: readonly string[];
  tier: CooperativeCelebrationTier;
  onOpenGroupPhoto?: () => void;
}) {
  const petalCount = tier === "festival" ? 52 : tier === "chorus" ? 38 : 24;
  return (
    <div className="world-cooperative-celebration" role="status" aria-label="하객 협동 축하 성공" data-tier={tier}>
      <div aria-hidden="true">
        {Array.from({ length: petalCount }, (_, index) => <i key={index}><Sparkles /></i>)}
      </div>
      <p>
        <PartyPopper aria-hidden="true" />
        <small>{tierLabel[tier]}</small>
        <strong>{participantNames.length}명이 함께 만든 축하 꽃비</strong>
        <span>{participantNames.join(" · ")}</span>
        {onOpenGroupPhoto ? (
          <button type="button" onClick={onOpenGroupPhoto}><Camera aria-hidden="true" />단체 사진 남기기</button>
        ) : null}
      </p>
    </div>
  );
}
