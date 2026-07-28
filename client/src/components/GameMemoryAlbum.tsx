import { Camera, Flower2, PartyPopper, UsersRound, X } from "lucide-react";
import type { WeddingPhotoAlbum } from "../game/weddingPhoto";
import type { GameMemoryAlbum as GameMemoryAlbumData, GameMemoryKind } from "../game/gameMemoryAlbum";
import { celebrationRewardLabel } from "../game/celebrationReward";

type GameMemoryAlbumProps = {
  album: GameMemoryAlbumData;
  photoAlbum: WeddingPhotoAlbum;
  collectedCount: number;
  totalCollectibles: number;
  rewardUnlocked: boolean;
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
  onClose,
  onOpenPhotoAlbum
}: GameMemoryAlbumProps) {
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
