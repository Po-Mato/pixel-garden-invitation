import { MapPinned, UserPlus, UsersRound, X } from "lucide-react";
import type { CompanionCandidate } from "../game/companionMode";

type CompanionDockProps = {
  candidates: readonly CompanionCandidate[];
  activeGuestId: string | null;
  pendingGuestId?: string | null;
  role?: "leader" | "follower" | null;
  onInvite: (guestId: string) => void;
  onStop: () => void;
  onOpenDestination?: () => void;
  sharedDestinationLabel?: string | null;
  waitingAtPortal?: boolean;
};

export function CompanionDock({
  candidates,
  activeGuestId,
  pendingGuestId = null,
  role = null,
  onInvite,
  onStop,
  onOpenDestination,
  sharedDestinationLabel = null,
  waitingAtPortal = false
}: CompanionDockProps) {
  if (candidates.length === 0 && !activeGuestId && !pendingGuestId) return null;
  const active = candidates.find(({ guestId }) => guestId === activeGuestId) ?? null;
  const pending = candidates.find(({ guestId }) => guestId === pendingGuestId) ?? null;
  return (
    <aside className="world-companion-dock" aria-label="같이 걷기">
      <header>
        <UsersRound aria-hidden="true" />
        <strong>{active
          ? `${active.nickname}님과 동행 중`
          : pending
            ? `${pending.nickname}님의 응답 기다리는 중`
            : "근처 하객에게 동행 초대"}</strong>
      </header>
      {active ? (
        <div className="world-companion-dock__actions">
          {role === "leader" && onOpenDestination ? (
            <button
              type="button"
              className="world-companion-dock__destination"
              aria-label="동행 공동 목적지 선택"
              onClick={(event) => { event.stopPropagation(); onOpenDestination(); }}
            ><MapPinned aria-hidden="true" /></button>
          ) : null}
          <button
            type="button"
            className="world-companion-dock__stop"
            aria-label="동행 그만하기"
            onClick={(event) => { event.stopPropagation(); onStop(); }}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div>
          {candidates.map((guest) => (
            <button
              key={guest.guestId}
              type="button"
              disabled={Boolean(pendingGuestId)}
              onClick={(event) => { event.stopPropagation(); onInvite(guest.guestId); }}
            >
              <UserPlus aria-hidden="true" />
              <span>{guest.guestId === pendingGuestId ? "응답 대기" : guest.nickname}</span>
            </button>
          ))}
        </div>
      )}
      {active && role ? <small>{waitingAtPortal
        ? "포털에서 서로의 도착을 기다려요"
        : sharedDestinationLabel
          ? `함께 ${sharedDestinationLabel}(으)로 이동 중`
          : role === "follower" ? "상대의 걸음을 따라가요" : "상대가 내 걸음을 따라와요"}</small> : null}
    </aside>
  );
}
