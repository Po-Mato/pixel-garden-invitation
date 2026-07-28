import { Camera, Flower2, X } from "lucide-react";
import { celebrationRewardLabel } from "../game/celebrationReward";

export function CelebrationRewardNotice({ onClose }: { onClose: () => void }) {
  return (
    <aside className="celebration-reward-notice" role="dialog" aria-label="축하 아이템 완주 보상">
      <div className="celebration-reward-notice__petals" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => <Flower2 key={index} />)}
      </div>
      <Flower2 aria-hidden="true" />
      <div>
        <small>COLLECTION COMPLETE</small>
        <strong>{celebrationRewardLabel} 획득</strong>
        <span><Camera aria-hidden="true" />앞으로 포토존 사진에 한정 꽃 프레임이 적용됩니다.</span>
      </div>
      <button type="button" aria-label="완주 보상 안내 닫기" onClick={onClose}><X aria-hidden="true" /></button>
    </aside>
  );
}
