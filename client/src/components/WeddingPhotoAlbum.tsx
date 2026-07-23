import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Download,
  Film,
  Image as ImageIcon,
  LockKeyhole,
  Maximize2,
  RotateCcw,
  Send,
  X
} from "lucide-react";
import { isShareAbortError } from "../invitation/browserActions";
import { formatEventDate, formatVenueLabel } from "../invitation/calendarEvent";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { invitationPublicUrl } from "../invitation/shareInvitation";
import {
  createWeddingPhotoStrip,
  isWeddingPhotoAlbumComplete,
  saveWeddingPhotoMemoryImage,
  saveWeddingPhotoStripBlob,
  shareWeddingPhotoMemoryImage,
  shareWeddingPhotoStripBlob,
  weddingPhotoAlbumProgress,
  weddingPhotoSpotOrder,
  type WeddingPhotoAlbum as WeddingPhotoAlbumData,
  type WeddingPhotoMemory,
  type WeddingPhotoStripData
} from "../game/weddingPhoto";
import { gardenWorld, type WorldPhotoSpot, type WorldPhotoSpotId } from "../game/world";

type WeddingPhotoAlbumProps = {
  album: WeddingPhotoAlbumData;
  nickname: string;
  onClose: () => void;
  onRetake: (spotId: WorldPhotoSpotId) => void;
};

type AlbumStatus = "idle" | "saving" | "saved" | "sharing" | "shared" | "fallback" | "canceled" | "error";

const photoSpots = weddingPhotoSpotOrder.map((spotId) => (
  gardenWorld.zones.flatMap((zone) => zone.photoSpots).find((spot) => spot.id === spotId)!
));

function canonicalInvitationUrl() {
  return document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? invitationPublicUrl;
}

function albumStatusMessage(status: AlbumStatus) {
  if (status === "saving") return "이미지를 만들고 있어요.";
  if (status === "saved") return "사진을 기기에 저장했어요.";
  if (status === "sharing") return "공유할 이미지를 준비하고 있어요.";
  if (status === "shared") return "공유 앱으로 사진을 보냈어요.";
  if (status === "fallback") return "공유를 지원하지 않아 사진을 저장했어요.";
  if (status === "canceled") return "공유를 취소했어요.";
  if (status === "error") return "이미지를 준비하지 못했어요. 잠시 후 다시 시도해주세요.";
  return "촬영한 사진은 이 기기에 보관됩니다.";
}

function memoryForSpot(album: WeddingPhotoAlbumData, spotId: WorldPhotoSpotId) {
  return album.photos.find((photo) => photo.photoSpotId === spotId) ?? null;
}

export function WeddingPhotoAlbum({ album, nickname, onClose, onRetake }: WeddingPhotoAlbumProps) {
  const { event } = usePublishedInvitationContent();
  const coupleOrder = useCoupleOrder();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lightboxCloseButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(false);
  const lightboxOpenRef = useRef(false);
  const progress = weddingPhotoAlbumProgress(album);
  const complete = isWeddingPhotoAlbumComplete(album);
  const latestPhoto = useMemo(() => (
    [...album.photos].sort((left, right) => right.createdAt - left.createdAt)[0] ?? null
  ), [album.photos]);
  const [selectedSpotId, setSelectedSpotId] = useState<WorldPhotoSpotId>(
    latestPhoto?.photoSpotId ?? weddingPhotoSpotOrder[0]
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [status, setStatus] = useState<AlbumStatus>("idle");
  const busy = status === "saving" || status === "sharing";
  const selectedPhoto = memoryForSpot(album, selectedSpotId);
  const selectedSpot = photoSpots.find((spot) => spot.id === selectedSpotId)!;
  const coupleNames = formatCoupleNames(event, coupleOrder);
  const stripData = useMemo<WeddingPhotoStripData>(() => ({
    album,
    coupleNames,
    guestName: nickname,
    dateLabel: formatEventDate(event),
    venueLabel: formatVenueLabel(event),
    publicUrl: canonicalInvitationUrl()
  }), [album, coupleNames, event, nickname]);
  onCloseRef.current = onClose;
  busyRef.current = busy;
  lightboxOpenRef.current = lightboxOpen;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape" || busyRef.current) return;
      if (lightboxOpenRef.current) setLightboxOpen(false);
      else onCloseRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (lightboxOpen) lightboxCloseButtonRef.current?.focus();
  }, [lightboxOpen]);

  const saveSelected = () => {
    if (!selectedPhoto || busy) return;
    setStatus("saving");
    try {
      saveWeddingPhotoMemoryImage(selectedPhoto);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const shareSelected = async () => {
    if (!selectedPhoto || busy) return;
    setStatus("sharing");
    try {
      const result = await shareWeddingPhotoMemoryImage(selectedPhoto, coupleNames, stripData.publicUrl);
      setStatus(result === "shared" ? "shared" : "fallback");
    } catch (error) {
      setStatus(isShareAbortError(error) ? "canceled" : "error");
    }
  };

  const buildStrip = async (action: "save" | "share") => {
    if (!complete || busy) return;
    setStatus(action === "save" ? "saving" : "sharing");
    try {
      const blob = await createWeddingPhotoStrip(stripData);
      if (action === "save") {
        saveWeddingPhotoStripBlob(blob, nickname);
        setStatus("saved");
      } else {
        const result = await shareWeddingPhotoStripBlob(blob, stripData);
        setStatus(result === "shared" ? "shared" : "fallback");
      }
    } catch (error) {
      setStatus(isShareAbortError(error) ? "canceled" : "error");
    }
  };

  const retake = (spot: WorldPhotoSpot) => {
    if (busy) return;
    onRetake(spot.id);
  };

  return (
    <div className="wedding-photo-album" role="dialog" aria-modal="true" aria-label="웨딩 포토앨범">
      <header className="wedding-photo-album__header">
        <div>
          <small>WEDDING GARDEN ALBUM</small>
          <h2>우리의 포토앨범</h2>
          <p aria-label={`포토앨범 ${progress} / ${weddingPhotoSpotOrder.length} 장`}>
            <strong>{progress}</strong> / {weddingPhotoSpotOrder.length} 장
          </p>
        </div>
        <button ref={closeButtonRef} type="button" aria-label="포토앨범 닫기" disabled={busy} onClick={onClose}><X /></button>
      </header>

      <div className="wedding-photo-album__workspace">
        <section className="wedding-photo-album__viewer" aria-label="선택한 기념 사진">
          <div className="wedding-photo-album__viewer-title">
            <span>{selectedSpot.sceneLabel}</span>
            <strong>{selectedSpot.label}</strong>
          </div>
          {selectedPhoto ? (
            <button
              type="button"
              className="wedding-photo-album__photo"
              aria-label={`${selectedPhoto.spotLabel} 사진 크게 보기`}
              onClick={() => setLightboxOpen(true)}
            >
              <img src={selectedPhoto.dataUrl} alt={`${selectedPhoto.spotLabel}에서 촬영한 기념 사진`} />
              <span><Maximize2 aria-hidden="true" /> 크게 보기</span>
            </button>
          ) : (
            <div className="wedding-photo-album__empty">
              <Camera aria-hidden="true" />
              <strong>아직 비어 있는 자리</strong>
              <span>{selectedSpot.label}에서 한 장을 남겨보세요.</span>
            </div>
          )}
          <div className="wedding-photo-album__photo-actions">
            {selectedPhoto ? (
              <>
                <button type="button" disabled={busy} onClick={saveSelected}><Download aria-hidden="true" />사진 저장</button>
                <button type="button" disabled={busy} onClick={() => void shareSelected()}><Send aria-hidden="true" />사진 공유</button>
              </>
            ) : null}
            <button type="button" disabled={busy} onClick={() => retake(selectedSpot)}>
              <RotateCcw aria-hidden="true" />{selectedPhoto ? "다시 촬영" : "촬영하기"}
            </button>
          </div>
        </section>

        <aside className="wedding-photo-album__collection" aria-label="포토존 사진 세 장">
          <div className="wedding-photo-album__slots">
            {photoSpots.map((spot, index) => {
              const photo = memoryForSpot(album, spot.id);
              return (
                <button
                  key={spot.id}
                  type="button"
                  className={selectedSpotId === spot.id ? "is-selected" : undefined}
                  aria-pressed={selectedSpotId === spot.id}
                  onClick={() => setSelectedSpotId(spot.id)}
                >
                  <span className="wedding-photo-album__slot-number">0{index + 1}</span>
                  {photo ? <img src={photo.dataUrl} alt="" /> : <ImageIcon aria-hidden="true" />}
                  <span><strong>{spot.label}</strong><small>{photo ? "촬영 완료" : "미촬영"}</small></span>
                </button>
              );
            })}
          </div>

          <section className={`wedding-photo-strip${complete ? " is-complete" : ""}`} aria-label="세로 포토스트립">
            <div className="wedding-photo-strip__preview" aria-hidden="true">
              <span className="wedding-photo-strip__title">GARDEN<br />PHOTO</span>
              {photoSpots.map((spot) => {
                const photo = memoryForSpot(album, spot.id);
                return photo
                  ? <img key={spot.id} src={photo.dataUrl} alt="" />
                  : <span key={spot.id} className="wedding-photo-strip__blank"><Camera /></span>;
              })}
              <small>{coupleNames}</small>
            </div>
            <div className="wedding-photo-strip__copy">
              <span><Film aria-hidden="true" /> PHOTO STRIP</span>
              <h3>{complete ? "세 장의 축하가 완성됐어요" : `${3 - progress}장을 더 촬영해주세요`}</h3>
              <p>{complete ? "세로 포토스트립으로 한 번에 간직해보세요." : "세 포토존을 모두 채우면 포토스트립이 열립니다."}</p>
              <div>
                <button type="button" disabled={!complete || busy} onClick={() => void buildStrip("save")}>
                  {complete ? <Download aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}저장
                </button>
                <button type="button" disabled={!complete || busy} onClick={() => void buildStrip("share")}>
                  {complete ? <Send aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}공유
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <p className="wedding-photo-album__status" aria-live="polite">{albumStatusMessage(status)}</p>

      {lightboxOpen && selectedPhoto ? (
        <div className="wedding-photo-lightbox" role="dialog" aria-modal="true" aria-label={`${selectedPhoto.spotLabel} 사진 전체 화면`}>
          <button ref={lightboxCloseButtonRef} type="button" aria-label="전체 화면 사진 닫기" onClick={() => setLightboxOpen(false)}><X /></button>
          <img src={selectedPhoto.dataUrl} alt={`${selectedPhoto.spotLabel}에서 촬영한 기념 사진 전체 화면`} />
          <p><span>{selectedPhoto.spotLabel}</span><strong>{nickname}님의 웨딩 가든 기록</strong></p>
        </div>
      ) : null}
    </div>
  );
}
