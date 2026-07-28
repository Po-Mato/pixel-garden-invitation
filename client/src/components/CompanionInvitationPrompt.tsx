import { Check, UserRoundPlus, X } from "lucide-react";

type CompanionInvitationPromptProps = {
  nickname: string;
  onAccept: () => void;
  onDecline: () => void;
};

export function CompanionInvitationPrompt({
  nickname,
  onAccept,
  onDecline
}: CompanionInvitationPromptProps) {
  return (
    <aside className="companion-invitation" role="dialog" aria-label="동행 초대">
      <UserRoundPlus aria-hidden="true" />
      <div><strong>{nickname}님의 같이 걷기 초대</strong><span>같은 맵에서 서로의 위치를 보며 이동합니다.</span></div>
      <button type="button" className="companion-invitation__accept" onClick={(event) => { event.stopPropagation(); onAccept(); }}>
        <Check aria-hidden="true" /><span>수락</span>
      </button>
      <button type="button" aria-label="동행 초대 거절" onClick={(event) => { event.stopPropagation(); onDecline(); }}>
        <X aria-hidden="true" />
      </button>
    </aside>
  );
}
