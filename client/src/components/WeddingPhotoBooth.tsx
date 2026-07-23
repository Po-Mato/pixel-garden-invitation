import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, Flower2, Hand, Heart, RotateCcw, Send, X } from "lucide-react";
import type { CharacterAppearance } from "@wedding-game/shared";
import { useGameFeedback } from "../feedback/GameFeedbackContext";
import {
  formatEventDate,
  formatVenueLabel
} from "../invitation/calendarEvent";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { invitationPublicUrl } from "../invitation/shareInvitation";
import { isShareAbortError } from "../invitation/browserActions";
import { resolveWorldMapAsset } from "../game/worldVisuals";
import {
  createWeddingPhotoNpcPreviewUrl,
  createWeddingPhotoCapture,
  saveWeddingPhotoBlob,
  saveWeddingPhotoMemory,
  shareWeddingPhotoBlob,
  type WeddingPhotoCapture,
  type WeddingPhotoData,
  type WeddingPhotoMemory
} from "../game/weddingPhoto";
import type { WorldPhotoPose, WorldPhotoSpot } from "../game/world";
import { CharacterSprite } from "./CharacterSprite";

type WeddingPhotoBoothProps = {
  spot: WorldPhotoSpot;
  nickname: string;
  appearance: CharacterAppearance;
  onClose: () => void;
  onCaptured: (memory: WeddingPhotoMemory) => void;
};

type PhotoStatus = "ready" | "capturing" | "captured" | "saving" | "saved" | "sharing" | "shared" | "fallback" | "canceled" | "error";

const poseOptions: Array<{ id: WorldPhotoPose; label: string; Icon: typeof Hand }> = [
  { id: "wave", label: "손인사", Icon: Hand },
  { id: "flower-heart", label: "꽃하트", Icon: Flower2 },
  { id: "hearts", label: "하트", Icon: Heart }
];

function canonicalInvitationUrl() {
  return document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? invitationPublicUrl;
}

function statusMessage(status: PhotoStatus) {
  if (status === "capturing") return "기념 사진을 만들고 있어요.";
  if (status === "captured") return "촬영을 마쳤어요. 사진을 확인해보세요.";
  if (status === "saving") return "사진을 저장하고 있어요.";
  if (status === "saved") return "기념 사진을 PNG로 저장했어요.";
  if (status === "sharing") return "모바일 공유를 준비하고 있어요.";
  if (status === "shared") return "공유 앱으로 기념 사진을 보냈어요.";
  if (status === "fallback") return "공유를 지원하지 않아 사진을 저장했어요.";
  if (status === "canceled") return "공유를 취소했어요.";
  if (status === "error") return "사진을 만들지 못했어요. 잠시 후 다시 시도해주세요.";
  return "포즈를 고른 뒤 촬영 버튼을 눌러주세요.";
}

export function WeddingPhotoBooth({
  spot,
  nickname,
  appearance,
  onClose,
  onCaptured
}: WeddingPhotoBoothProps) {
  const { event } = usePublishedInvitationContent();
  const coupleOrder = useCoupleOrder();
  const { playFeedback } = useGameFeedback();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const captureUrlRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(false);
  const [pose, setPose] = useState<WorldPhotoPose>("wave");
  const [capture, setCapture] = useState<WeddingPhotoCapture | null>(null);
  const [captureUrl, setCaptureUrl] = useState<string | null>(null);
  const [npcPreviewUrls, setNpcPreviewUrls] = useState<{ bride: string | null; groom: string | null }>({
    bride: null,
    groom: null
  });
  const [status, setStatus] = useState<PhotoStatus>("ready");
  const busy = status === "capturing" || status === "saving" || status === "sharing";
  onCloseRef.current = onClose;
  busyRef.current = busy;
  const data = useMemo<WeddingPhotoData>(() => ({
    guestName: nickname,
    appearance,
    coupleNames: formatCoupleNames(event, coupleOrder),
    dateLabel: formatEventDate(event),
    venueLabel: formatVenueLabel(event),
    publicUrl: canonicalInvitationUrl(),
    pose,
    spot
  }), [appearance, coupleOrder, event, nickname, pose, spot]);

  const releaseCaptureUrl = () => {
    if (!captureUrlRef.current) return;
    URL.revokeObjectURL(captureUrlRef.current);
    captureUrlRef.current = null;
  };

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) onCloseRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      releaseCaptureUrl();
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const kinds = spot.cast === "couple" ? (["bride", "groom"] as const) : (["bride"] as const);
    void Promise.all(kinds.map(async (kind) => [kind, await createWeddingPhotoNpcPreviewUrl(kind)] as const))
      .then((entries) => {
        if (!active) return;
        setNpcPreviewUrls((current) => ({ ...current, ...Object.fromEntries(entries) }));
      });
    return () => {
      active = false;
    };
  }, [spot.cast]);

  const resetCapture = (nextPose = pose) => {
    releaseCaptureUrl();
    setCapture(null);
    setCaptureUrl(null);
    setPose(nextPose);
    setStatus("ready");
  };

  const takePhoto = async () => {
    if (busy) return;
    setStatus("capturing");
    try {
      const nextCapture = await createWeddingPhotoCapture(data);
      releaseCaptureUrl();
      const nextUrl = URL.createObjectURL(nextCapture.blob);
      captureUrlRef.current = nextUrl;
      setCapture(nextCapture);
      setCaptureUrl(nextUrl);
      saveWeddingPhotoMemory(nextCapture.memory);
      onCaptured(nextCapture.memory);
      setStatus("captured");
      playFeedback("photo");
    } catch {
      setStatus("error");
    }
  };

  const savePhoto = () => {
    if (!capture || busy) return;
    setStatus("saving");
    try {
      saveWeddingPhotoBlob(capture.blob, data);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const sharePhoto = async () => {
    if (!capture || busy) return;
    setStatus("sharing");
    try {
      const result = await shareWeddingPhotoBlob(capture.blob, data);
      setStatus(result === "shared" ? "shared" : "fallback");
    } catch (error) {
      setStatus(isShareAbortError(error) ? "canceled" : "error");
    }
  };

  return (
    <div className="wedding-photo-booth" role="dialog" aria-modal="true" aria-label="웨딩 포토존 촬영">
      <header className="wedding-photo-booth__header">
        <div><small>PHOTO SPOT</small><h2>{spot.label}</h2><p>{spot.sceneLabel}</p></div>
        <button ref={closeButtonRef} type="button" aria-label="포토존 닫기" disabled={busy} onClick={onClose}><X /></button>
      </header>

      <div className="wedding-photo-booth__viewport">
        {captureUrl ? (
          <img className="wedding-photo-booth__result" src={captureUrl} alt={`${nickname}님의 ${spot.label} 기념 사진`} />
        ) : (
          <div
            className={`wedding-photo-booth__scene wedding-photo-booth__scene--${pose}`}
            style={{
              backgroundImage: `url("${resolveWorldMapAsset(spot.zoneId, "background.webp")}")`,
              backgroundPosition: spot.previewPosition
            }}
            aria-label={`${spot.sceneLabel} 촬영 미리보기`}
          >
            <span className="wedding-photo-booth__frame" aria-hidden="true" />
            <span className="wedding-photo-booth__petals" aria-hidden="true" />
            <div className={`wedding-photo-booth__cast wedding-photo-booth__cast--${spot.cast}`} aria-hidden="true">
              <span
                className="wedding-photo-booth__npc wedding-photo-booth__npc--bride"
                style={npcPreviewUrls.bride ? {
                  backgroundImage: `url("${npcPreviewUrls.bride}")`,
                  backgroundPosition: "0 0",
                  backgroundSize: "96px 144px"
                } : {
                  backgroundImage: `url("${import.meta.env.BASE_URL}characters/generated/npc/bride__walk.png")`,
                  backgroundPosition: "-96px 0",
                  backgroundSize: "288px 576px"
                }}
              />
              <span className="wedding-photo-booth__guest"><CharacterSprite appearance={appearance} direction="down" moving={false} displayMode="preview" /></span>
              {spot.cast === "couple" ? (
                <span
                  className="wedding-photo-booth__npc wedding-photo-booth__npc--groom"
                  style={{
                    backgroundImage: npcPreviewUrls.groom ? `url("${npcPreviewUrls.groom}")` : "none",
                    backgroundPosition: "0 0",
                    backgroundSize: "96px 144px"
                  }}
                />
              ) : null}
            </div>
            <span className="wedding-photo-booth__pose-effect" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="wedding-photo-booth__controls">
        {!capture ? (
          <div className="wedding-photo-booth__poses" role="group" aria-label="촬영 포즈">
            {poseOptions.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={pose === id}
                disabled={busy}
                onClick={() => resetCapture(id)}
              >
                <Icon aria-hidden="true" /><span>{label}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="wedding-photo-booth__actions">
          {!capture ? (
            <button type="button" className="wedding-photo-booth__shutter" disabled={busy} onClick={() => void takePhoto()}>
              <Camera aria-hidden="true" /><span>{busy ? "촬영 중" : "기념 촬영"}</span>
            </button>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={savePhoto}><Download aria-hidden="true" /><span>PNG 저장</span></button>
              <button type="button" disabled={busy} onClick={() => void sharePhoto()}><Send aria-hidden="true" /><span>모바일 공유</span></button>
              <button type="button" disabled={busy} onClick={() => resetCapture()}><RotateCcw aria-hidden="true" /><span>다시 찍기</span></button>
            </>
          )}
        </div>
        <p className="wedding-photo-booth__status" aria-live="polite">{statusMessage(status)}</p>
      </div>
    </div>
  );
}
