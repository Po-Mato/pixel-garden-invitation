import { UserPlus, UsersRound, X } from "lucide-react";
import type { CompanionCandidate } from "../game/companionMode";

type CompanionDockProps = {
  candidates: readonly CompanionCandidate[];
  activeGuestId: string | null;
  onSelect: (guestId: string) => void;
  onStop: () => void;
};

export function CompanionDock({ candidates, activeGuestId, onSelect, onStop }: CompanionDockProps) {
  if (candidates.length === 0 && !activeGuestId) return null;
  const active = candidates.find(({ guestId }) => guestId === activeGuestId) ?? null;
  return (
    <aside className="world-companion-dock" aria-label="같이 걷기">
      <header><UsersRound aria-hidden="true" /><strong>{active ? `${active.nickname}님과 동행 중` : "근처 하객과 같이 걷기"}</strong></header>
      {active ? (
        <button
          type="button"
          className="world-companion-dock__stop"
          aria-label="동행 그만하기"
          onClick={(event) => { event.stopPropagation(); onStop(); }}
        >
          <X aria-hidden="true" />
        </button>
      ) : (
        <div>
          {candidates.map((guest) => (
            <button
              key={guest.guestId}
              type="button"
              onClick={(event) => { event.stopPropagation(); onSelect(guest.guestId); }}
            >
              <UserPlus aria-hidden="true" /><span>{guest.nickname}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
