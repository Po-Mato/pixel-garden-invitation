import { Heart, PartyPopper, Users, X } from "lucide-react";

export function NpcGroupCelebrationNotice({ onClose }: { onClose: () => void }) {
  return (
    <aside className="npc-group-celebration" role="status" aria-label="인연 단체 축하 이벤트">
      <button type="button" aria-label="단체 축하 알림 닫기" onClick={onClose}><X aria-hidden="true" /></button>
      <span><PartyPopper aria-hidden="true" />SPECIAL MOMENT</span>
      <strong>두 사람과 소중한 인연이 되었어요</strong>
      <p><Heart aria-hidden="true" />신랑·신부와 주변 하객들이 함께 축하합니다.</p>
      <small><Users aria-hidden="true" />인연 피날레 이벤트 완료</small>
    </aside>
  );
}
