import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Download, Images, MessageCircleHeart, Send, Share2, Sparkles, X } from "lucide-react";
import type { CharacterAppearance } from "@wedding-game/shared";
import { isShareAbortError } from "../invitation/browserActions";
import {
  formatEventDate,
  formatEventStartTime,
  formatVenueLabel
} from "../invitation/calendarEvent";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { invitationPublicUrl } from "../invitation/shareInvitation";
import { journeyCheckpoints } from "../game/journeyProgress";
import {
  saveJourneyKeepsake,
  shareJourneyKeepsake,
  type JourneyKeepsakeData
} from "../game/journeyKeepsake";
import { loadWeddingPhotoAlbum, weddingPhotoAlbumProgress } from "../game/weddingPhoto";
import { CharacterSprite } from "./CharacterSprite";

type JourneyCompletionProps = {
  nickname: string;
  appearance: CharacterAppearance;
  onClose: () => void;
  onOpenRsvp: () => void;
  onOpenShare: () => void;
  onOpenPhotoAlbum: () => void;
};

type KeepsakeStatus = "idle" | "saving" | "saved" | "sharing" | "shared" | "fallback" | "canceled" | "error";

function canonicalInvitationUrl() {
  return document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? invitationPublicUrl;
}

function resolveAssetUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return new URL(path, document.baseURI).href;
}

function statusMessage(status: KeepsakeStatus) {
  if (status === "saving") return "기념 카드 이미지를 만들고 있습니다.";
  if (status === "saved") return "기념 카드를 이미지로 저장했습니다.";
  if (status === "sharing") return "기념 카드를 준비하고 있습니다.";
  if (status === "shared") return "공유 앱으로 기념 카드를 전달했습니다.";
  if (status === "fallback") return "이미지 공유를 지원하지 않아 기념 카드를 저장했습니다.";
  if (status === "canceled") return "공유를 취소했습니다.";
  if (status === "error") return "기념 카드를 만들지 못했습니다. 잠시 후 다시 시도해주세요.";
  return "";
}

export function JourneyCompletion({
  nickname,
  appearance,
  onClose,
  onOpenRsvp,
  onOpenShare,
  onOpenPhotoAlbum
}: JourneyCompletionProps) {
  const { event, content } = usePublishedInvitationContent();
  const coupleOrder = useCoupleOrder();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(false);
  const [status, setStatus] = useState<KeepsakeStatus>("idle");
  const busy = status === "saving" || status === "sharing";
  onCloseRef.current = onClose;
  busyRef.current = busy;
  const coupleNames = formatCoupleNames(event, coupleOrder);
  const photoAlbum = useMemo(loadWeddingPhotoAlbum, []);
  const photoMemory = [...photoAlbum.photos].sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
  const photoProgress = weddingPhotoAlbumProgress(photoAlbum);
  const finalePhoto = content.gallery.find((photo) => photo.id === "10-sunlit-finale")
    ?? content.gallery[content.gallery.length - 1];
  const keepsakeData = useMemo<JourneyKeepsakeData>(() => ({
    guestName: nickname,
    coupleNames,
    dateLabel: formatEventDate(event),
    timeLabel: formatEventStartTime(event),
    venueLabel: formatVenueLabel(event),
    checkpointLabels: journeyCheckpoints.map((checkpoint) => checkpoint.label),
    photoUrl: photoMemory?.dataUrl || resolveAssetUrl(finalePhoto.assetPath),
    publicUrl: canonicalInvitationUrl()
  }), [coupleNames, event, finalePhoto.assetPath, nickname, photoMemory?.dataUrl]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) onCloseRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  const saveKeepsake = async () => {
    if (busy) return;
    setStatus("saving");
    try {
      await saveJourneyKeepsake(keepsakeData);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const shareKeepsake = async () => {
    if (busy) return;
    setStatus("sharing");
    try {
      const result = await shareJourneyKeepsake(keepsakeData);
      setStatus(result === "shared" ? "shared" : "fallback");
    } catch (error) {
      setStatus(isShareAbortError(error) ? "canceled" : "error");
    }
  };

  return (
    <div
      className="journey-completion"
      role="dialog"
      aria-modal="true"
      aria-label="방문 여정 완주"
    >
      <div className="journey-completion__petals" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
      </div>

      <article className="journey-completion__experience">
        <button
          ref={closeButtonRef}
          type="button"
          className="journey-completion__close"
          aria-label="완주 안내 닫기"
          disabled={busy}
          onClick={onClose}
        >
          <X />
        </button>

        <section className="journey-completion__scene" aria-label="신랑 신부와 함께하는 완주 장면">
          <span className="journey-completion__moon" aria-hidden="true" />
          <span className="journey-completion__arch" aria-hidden="true"><i /><i /><i /></span>
          <div className="journey-completion__cast" aria-hidden="true">
            <span
              className="journey-completion__npc journey-completion__npc--bride"
              style={{ backgroundImage: `url("${import.meta.env.BASE_URL}characters/generated/npc/bride__idle.png")` }}
            />
            <span className="journey-completion__guest">
              <CharacterSprite appearance={appearance} direction="down" moving={false} displayMode="world" />
            </span>
            <span
              className="journey-completion__npc journey-completion__npc--groom"
              style={{ backgroundImage: `url("${import.meta.env.BASE_URL}characters/generated/npc/groom__idle.png")` }}
            />
          </div>
          <div className="journey-completion__sparkles" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => <Sparkles key={index} />)}
          </div>
        </section>

        <section className="journey-completion__body">
          <div className="journey-completion__heading">
            <small>WEDDING TRAIL COMPLETE</small>
            <h2 id="journey-completion-title">
              <span>{nickname}님,</span>{" "}<span>축하의 정원을 완주했어요</span>
            </h2>
            <p>두 사람의 소중한 순간을 함께 걸어주셔서 고맙습니다.</p>
          </div>

          <figure className="journey-keepsake-preview" aria-label="완주 기념 카드 미리보기">
            <figcaption><span>YOUR WEDDING TRAIL</span><strong>{coupleNames}</strong></figcaption>
            {photoMemory ? (
              <div className="journey-keepsake-preview__photo">
                <img src={photoMemory.dataUrl} alt={`${photoMemory.spotLabel}에서 촬영한 기념 사진`} />
                <span><Camera aria-hidden="true" />포토앨범 {photoProgress}/3 · {photoMemory.spotLabel}</span>
              </div>
            ) : null}
            <div className="journey-keepsake-preview__stamps" aria-label="방문 스탬프 5개 완료">
              {journeyCheckpoints.map((checkpoint) => (
                <span key={checkpoint.id}><Check aria-hidden="true" /><small>{checkpoint.label}</small></span>
              ))}
            </div>
            <p><strong>{formatEventDate(event)}</strong><span>{formatEventStartTime(event)} · {formatVenueLabel(event)}</span></p>
          </figure>

          <div className="journey-completion__keepsake-actions">
            <button type="button" disabled={busy} onClick={() => void saveKeepsake()}>
              <Download aria-hidden="true" />
              <span><small>PNG 이미지</small><strong>기념 카드 저장</strong></span>
            </button>
            <button type="button" disabled={busy} onClick={() => void shareKeepsake()}>
              <Send aria-hidden="true" />
              <span><small>모바일 공유</small><strong>기념 카드 보내기</strong></span>
            </button>
          </div>

          <div className="journey-completion__next-actions">
            <button type="button" disabled={busy} onClick={onOpenRsvp}>
              <MessageCircleHeart aria-hidden="true" />참석 답변하기
            </button>
            <button type="button" disabled={busy} onClick={onOpenShare}>
              <Share2 aria-hidden="true" />초대장 공유
            </button>
            <button type="button" disabled={busy} onClick={onOpenPhotoAlbum}>
              <Images aria-hidden="true" />포토앨범 {photoProgress}/3
            </button>
          </div>

          <p className="journey-completion__status" aria-live="polite">{statusMessage(status)}</p>
        </section>
      </article>
    </div>
  );
}
