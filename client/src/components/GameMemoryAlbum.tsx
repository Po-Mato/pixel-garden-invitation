import { useMemo, useState } from "react";
import { Camera, Download, Flower2, PartyPopper, Send, UsersRound, X } from "lucide-react";
import { isShareAbortError } from "../invitation/browserActions";
import { formatEventDate, formatVenueLabel } from "../invitation/calendarEvent";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { invitationPublicUrl } from "../invitation/shareInvitation";
import type { WeddingPhotoAlbum } from "../game/weddingPhoto";
import type { GameMemoryAlbum as GameMemoryAlbumData, GameMemoryKind } from "../game/gameMemoryAlbum";
import {
  createGameMemoryKeepsake,
  saveGameMemoryKeepsake,
  shareGameMemoryKeepsake,
  type GameMemoryKeepsakeData
} from "../game/gameMemoryKeepsake";
import { celebrationRewardLabel } from "../game/celebrationReward";

type GameMemoryAlbumProps = {
  album: GameMemoryAlbumData;
  photoAlbum: WeddingPhotoAlbum;
  collectedCount: number;
  totalCollectibles: number;
  rewardUnlocked: boolean;
  nickname: string;
  onClose: () => void;
  onOpenPhotoAlbum: () => void;
};

const memoryIcon: Record<GameMemoryKind, typeof Flower2> = {
  collectible: Flower2,
  companion: UsersRound,
  celebration: PartyPopper
};

function formatMemoryTime(createdAt: string) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? "기록됨" : new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function GameMemoryAlbum({
  album,
  photoAlbum,
  collectedCount,
  totalCollectibles,
  rewardUnlocked,
  nickname,
  onClose,
  onOpenPhotoAlbum
}: GameMemoryAlbumProps) {
  const { event } = usePublishedInvitationContent();
  const coupleOrder = useCoupleOrder();
  const [keepsakeStatus, setKeepsakeStatus] = useState<"idle" | "saving" | "saved" | "sharing" | "shared" | "fallback" | "canceled" | "error">("idle");
  const busy = keepsakeStatus === "saving" || keepsakeStatus === "sharing";
  const hasMemories = album.entries.length > 0 || photoAlbum.photos.length > 0 || collectedCount > 0;
  const keepsakeData = useMemo<GameMemoryKeepsakeData>(() => ({
    album,
    photoAlbum,
    guestName: nickname,
    coupleNames: formatCoupleNames(event, coupleOrder),
    dateLabel: formatEventDate(event),
    venueLabel: formatVenueLabel(event),
    publicUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? invitationPublicUrl,
    collectedCount,
    totalCollectibles
  }), [album, collectedCount, coupleOrder, event, nickname, photoAlbum, totalCollectibles]);

  const buildKeepsake = async (action: "save" | "share") => {
    if (!hasMemories || busy) return;
    setKeepsakeStatus(action === "save" ? "saving" : "sharing");
    try {
      const blob = await createGameMemoryKeepsake(keepsakeData);
      if (action === "save") {
        saveGameMemoryKeepsake(blob, nickname);
        setKeepsakeStatus("saved");
      } else {
        const result = await shareGameMemoryKeepsake(blob, keepsakeData);
        setKeepsakeStatus(result === "shared" ? "shared" : "fallback");
      }
    } catch (error) {
      setKeepsakeStatus(isShareAbortError(error) ? "canceled" : "error");
    }
  };

  const keepsakeStatusLabel = keepsakeStatus === "saving" ? "추억 이미지를 만들고 있어요."
    : keepsakeStatus === "saved" ? "추억 이미지를 기기에 저장했어요."
      : keepsakeStatus === "sharing" ? "공유 이미지를 준비하고 있어요."
        : keepsakeStatus === "shared" ? "공유 앱으로 추억을 보냈어요."
          : keepsakeStatus === "fallback" ? "공유를 지원하지 않아 이미지로 저장했어요."
            : keepsakeStatus === "canceled" ? "공유를 취소했어요."
              : keepsakeStatus === "error" ? "추억 이미지를 만들지 못했어요."
                : "수집·사진·동행 기록을 한 장으로 간직할 수 있어요.";

  return (
    <div className="game-memory-album" role="dialog" aria-modal="true" aria-label="게임 추억 앨범">
      <header>
        <div><small>WEDDING GARDEN MEMORIES</small><h2>정원에서 만든 추억</h2></div>
        <button type="button" aria-label="게임 추억 앨범 닫기" onClick={onClose}><X /></button>
      </header>

      <section className="game-memory-album__summary" aria-label="추억 현황">
        <span><Flower2 /><strong>{collectedCount}/{totalCollectibles}</strong><small>축하 아이템</small></span>
        <button type="button" onClick={onOpenPhotoAlbum}><Camera /><strong>{photoAlbum.photos.length}/3</strong><small>포토존 사진</small></button>
        <span><UsersRound /><strong>{album.entries.filter(({ kind }) => kind === "companion").length}</strong><small>동행 기록</small></span>
      </section>

      <section className="game-memory-album__reward" data-unlocked={rewardUnlocked || undefined}>
        <Flower2 aria-hidden="true" />
        <div><strong>{celebrationRewardLabel}</strong><span>{rewardUnlocked ? "획득 완료 · 포토존 자동 적용" : `${totalCollectibles - collectedCount}개를 더 모으면 열립니다`}</span></div>
      </section>

      {photoAlbum.photos.length > 0 ? (
        <section className="game-memory-album__photos" aria-label="최근 포토존 사진">
          {photoAlbum.photos.map((photo) => <img key={photo.photoSpotId} src={photo.dataUrl} alt={`${photo.spotLabel} 기념 사진`} />)}
        </section>
      ) : null}

      <section className="game-memory-album__keepsake" aria-label="게임 추억 이미지 저장과 공유">
        <div><strong>정원 추억 포토스트립</strong><span>사진과 게임 기록을 세로 이미지 한 장으로 정리합니다.</span></div>
        <div>
          <button type="button" disabled={!hasMemories || busy} onClick={() => void buildKeepsake("save")}><Download aria-hidden="true" />저장</button>
          <button type="button" disabled={!hasMemories || busy} onClick={() => void buildKeepsake("share")}><Send aria-hidden="true" />공유</button>
        </div>
        <p aria-live="polite">{keepsakeStatusLabel}</p>
      </section>

      <section className="game-memory-album__timeline" aria-label="게임 추억 기록">
        <h3>기억의 조각</h3>
        {album.entries.length > 0 ? album.entries.map((entry) => {
          const Icon = memoryIcon[entry.kind];
          return (
            <article key={entry.id}>
              <Icon aria-hidden="true" />
              <div><strong>{entry.title}</strong><span>{entry.detail}</span></div>
              <time dateTime={entry.createdAt}>{formatMemoryTime(entry.createdAt)}</time>
            </article>
          );
        }) : <p>꽃잎을 모으거나 다른 하객과 함께 걸으면 여기에 기록됩니다.</p>}
      </section>
    </div>
  );
}
