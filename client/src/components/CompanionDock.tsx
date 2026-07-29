import { Hand, Heart, LocateFixed, MapPinned, QrCode, Route, Target, UserPlus, UsersRound, X } from "lucide-react";
import type { CompanionPing, WorldZoneId } from "@wedding-game/shared";
import type { CompanionCandidate } from "../game/companionMode";

type CompanionDockProps = {
  candidates: readonly CompanionCandidate[];
  activeGuestId: string | null;
  activeNickname?: string | null;
  pendingGuestId?: string | null;
  role?: "leader" | "follower" | null;
  onInvite: (guestId: string) => void;
  onStop: () => void;
  onOpenDestination?: () => void;
  sharedDestinationLabel?: string | null;
  waitingAtPortal?: boolean;
  recentPing?: { ping: CompanionPing; nickname: string } | null;
  destinationRequested?: boolean;
  rejoinZoneId?: WorldZoneId | null;
  rejoinZoneLabel?: string | null;
  onPing?: (ping: CompanionPing) => void;
  onRequestDestination?: () => void;
  onAcceptDestinationRequest?: () => void;
  onRejoin?: () => void;
  onOpenWaitingRoom?: () => void;
  shareStatus?: string | null;
  rendezvousLabel?: string | null;
  onReserveRendezvous?: () => void;
  onCancelRendezvous?: () => void;
};

export function CompanionDock({
  candidates,
  activeGuestId,
  activeNickname = null,
  pendingGuestId = null,
  role = null,
  onInvite,
  onStop,
  onOpenDestination,
  sharedDestinationLabel = null,
  waitingAtPortal = false,
  recentPing = null,
  destinationRequested = false,
  rejoinZoneId = null,
  rejoinZoneLabel = null,
  onPing,
  onRequestDestination,
  onAcceptDestinationRequest,
  onRejoin,
  onOpenWaitingRoom,
  shareStatus = null,
  rendezvousLabel = null,
  onReserveRendezvous,
  onCancelRendezvous
}: CompanionDockProps) {
  if (candidates.length === 0 && !activeGuestId && !pendingGuestId && !onOpenWaitingRoom) return null;
  const active = candidates.find(({ guestId }) => guestId === activeGuestId) ?? null;
  const pending = candidates.find(({ guestId }) => guestId === pendingGuestId) ?? null;
  const hasActive = Boolean(activeGuestId);
  return (
    <aside className="world-companion-dock" aria-label="같이 걷기">
      <header>
        <UsersRound aria-hidden="true" />
        <strong>{hasActive
          ? active
            ? `${active.nickname}님과 동행 중`
            : `${activeNickname ?? "동행 하객"}님 재연결 대기`
          : pending
            ? `${pending.nickname}님의 응답 기다리는 중`
            : "근처 하객에게 동행 초대"}</strong>
      </header>
      {hasActive ? (
        <div className="world-companion-dock__actions">
          {role === "leader" && onOpenDestination ? (
            <button
              type="button"
              className="world-companion-dock__destination"
              aria-label="동행 공동 목적지 선택"
              onClick={(event) => { event.stopPropagation(); onOpenDestination(); }}
            ><MapPinned aria-hidden="true" /></button>
          ) : null}
          {role === "follower" && onRequestDestination ? (
            <button
              type="button"
              className="world-companion-dock__destination"
              aria-label="동행 목적지 변경 요청"
              title="목적지 변경 요청"
              onClick={(event) => { event.stopPropagation(); onRequestDestination(); }}
            ><Route aria-hidden="true" /></button>
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
      {hasActive && onPing ? (
        <div className="world-companion-dock__pings" role="group" aria-label="동행 핑 보내기">
          {([
            ["wait", "잠시만요", Hand],
            ["here", "여기예요", LocateFixed],
            ["cheer", "좋아요", Heart]
          ] as const).map(([ping, label, Icon]) => (
            <button
              key={ping}
              type="button"
              aria-label={label}
              title={label}
              onClick={(event) => { event.stopPropagation(); onPing(ping); }}
            ><Icon aria-hidden="true" /></button>
          ))}
        </div>
      ) : null}
      {destinationRequested && onAcceptDestinationRequest ? (
        <button
          type="button"
          className="world-companion-dock__request"
          onClick={(event) => { event.stopPropagation(); onAcceptDestinationRequest(); }}
        >
          <MapPinned aria-hidden="true" />요청받은 목적지 고르기
        </button>
      ) : null}
      {rejoinZoneId && onRejoin ? (
        <button
          type="button"
          className="world-companion-dock__rejoin"
          onClick={(event) => { event.stopPropagation(); onRejoin(); }}
        >
          <Route aria-hidden="true" />{rejoinZoneLabel ?? "다른 구역"}로 재합류
        </button>
      ) : null}
      {hasActive && onReserveRendezvous && !rejoinZoneId ? (
        <button
          type="button"
          className="world-companion-dock__rendezvous"
          onClick={(event) => {
            event.stopPropagation();
            if (rendezvousLabel && onCancelRendezvous) onCancelRendezvous();
            else onReserveRendezvous();
          }}
        >
          <Target aria-hidden="true" />{rendezvousLabel ? "합류 예약 취소" : "중간 타일에서 만나기"}
        </button>
      ) : null}
      {rendezvousLabel ? (
        <p className="world-companion-dock__rendezvous-status" role="status">
          <MapPinned aria-hidden="true" />{rendezvousLabel}
        </p>
      ) : null}
      {recentPing ? (
        <p className="world-companion-dock__ping-message" role="status">
          {recentPing.nickname}님 · {recentPing.ping === "wait"
            ? "잠시만요"
            : recentPing.ping === "here" ? "여기예요" : "좋아요"}
        </p>
      ) : null}
      {onOpenWaitingRoom ? (
        <button
          type="button"
          className="world-companion-dock__share"
          onClick={(event) => { event.stopPropagation(); onOpenWaitingRoom(); }}
        >
          <QrCode aria-hidden="true" />QR·링크로 초대
        </button>
      ) : null}
      {shareStatus ? <p className="world-companion-dock__share-status" role="status">{shareStatus}</p> : null}
      {hasActive && role ? <small>{!active
        ? "동행 상태를 보존하고 상대의 재접속을 기다려요"
        : waitingAtPortal
        ? "포털에서 서로의 도착을 기다려요"
        : sharedDestinationLabel
          ? `함께 ${sharedDestinationLabel}(으)로 이동 중`
          : rejoinZoneId
            ? "서로 다른 구역에 있어 재합류 안내를 시작할 수 있어요"
            : role === "follower" ? "상대의 걸음을 따라가요" : "상대가 내 걸음을 따라와요"}</small> : null}
    </aside>
  );
}
