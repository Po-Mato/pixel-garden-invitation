import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bird,
  Camera,
  Crop,
  Download,
  Flower2,
  Frame,
  Heart,
  Gem,
  LayoutGrid,
  MessageSquareText,
  Leaf,
  Move,
  PartyPopper,
  Printer,
  RotateCw,
  Send,
  Save,
  Scaling,
  Sparkles,
  RotateCcw,
  Trash2,
  UsersRound,
  X
} from "lucide-react";
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
  createGameMemoryKeepsakePdf,
  createGameMemoryKeepsakePrint,
  createGameMemoryKeepsakeTemplate,
  defaultGameMemoryKeepsakeOptions,
  applyGameMemoryKeepsakeTemplate,
  loadGameMemoryKeepsakeOptions,
  loadGameMemoryKeepsakeTemplates,
  gameMemoryKeepsakePrintGuide,
  gameMemoryKeepsakePrintVendorProfiles,
  orderGameMemoryKeepsakePhotos,
  saveGameMemoryKeepsake,
  saveGameMemoryKeepsakePdf,
  saveGameMemoryKeepsakePrint,
  saveGameMemoryKeepsakeOptions,
  saveGameMemoryKeepsakeTemplates,
  shareGameMemoryKeepsake,
  type GameMemoryKeepsakeLayout,
  type GameMemoryKeepsakeFrame,
  type GameMemoryKeepsakeSticker,
  type GameMemoryPhotoTransform,
  type GameMemoryStickerTransform,
  type GameMemoryTextSticker,
  type GameMemoryKeepsakeData,
  type GameMemoryKeepsakePrintFormat,
  type GameMemoryKeepsakePrintVendor
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
  const [keepsakeStatus, setKeepsakeStatus] = useState<"idle" | "saving" | "saved" | "sharing" | "shared" | "printing" | "printed-a4" | "printed-postcard" | "printed-pdf-a4" | "printed-pdf-postcard" | "fallback" | "canceled" | "error">("idle");
  const [keepsakeOptions, setKeepsakeOptions] = useState(loadGameMemoryKeepsakeOptions);
  const [keepsakeTemplates, setKeepsakeTemplates] = useState(loadGameMemoryKeepsakeTemplates);
  const [activePhotoId, setActivePhotoId] = useState(() => photoAlbum.photos[0]?.photoSpotId ?? null);
  const [activeSticker, setActiveSticker] = useState<GameMemoryKeepsakeSticker | null>(null);
  const [textStickerSelected, setTextStickerSelected] = useState(false);
  const [templateStatus, setTemplateStatus] = useState("");
  const [printPreviewFormat, setPrintPreviewFormat] = useState<GameMemoryKeepsakePrintFormat>("a4");
  const [printVendor, setPrintVendor] = useState<GameMemoryKeepsakePrintVendor>("standard-lab");
  const [postcardDuplex, setPostcardDuplex] = useState(true);
  const [printPreviewSide, setPrintPreviewSide] = useState<"front" | "back">("front");
  const photoDragRef = useRef<{
    photoId: NonNullable<typeof activePhotoId>;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const stickerDragRef = useRef<{
    sticker: GameMemoryKeepsakeSticker;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const textStickerDragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const busy = keepsakeStatus === "saving" || keepsakeStatus === "sharing" || keepsakeStatus === "printing";
  const hasMemories = album.entries.length > 0 || photoAlbum.photos.length > 0 || collectedCount > 0;
  const orderedPhotos = useMemo(
    () => orderGameMemoryKeepsakePhotos(photoAlbum, keepsakeOptions.photoOrder),
    [keepsakeOptions.photoOrder, photoAlbum]
  );
  const printGuide = useMemo(
    () => gameMemoryKeepsakePrintGuide(printPreviewFormat, printVendor),
    [printPreviewFormat, printVendor]
  );
  const keepsakeData = useMemo<GameMemoryKeepsakeData>(() => ({
    album,
    photoAlbum,
    guestName: nickname,
    coupleNames: formatCoupleNames(event, coupleOrder),
    dateLabel: formatEventDate(event),
    venueLabel: formatVenueLabel(event),
    publicUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? invitationPublicUrl,
    collectedCount,
    totalCollectibles,
    options: keepsakeOptions
  }), [album, collectedCount, coupleOrder, event, keepsakeOptions, nickname, photoAlbum, totalCollectibles]);

  useEffect(() => {
    saveGameMemoryKeepsakeOptions(keepsakeOptions);
  }, [keepsakeOptions]);

  useEffect(() => {
    saveGameMemoryKeepsakeTemplates(keepsakeTemplates);
  }, [keepsakeTemplates]);

  useEffect(() => {
    if (activePhotoId && orderedPhotos.some(({ photoSpotId }) => photoSpotId === activePhotoId)) return;
    setActivePhotoId(orderedPhotos[0]?.photoSpotId ?? null);
  }, [activePhotoId, orderedPhotos]);

  const updatePhotoTransformFor = (
    photoId: NonNullable<typeof activePhotoId>,
    patch: Partial<GameMemoryPhotoTransform>
  ) => {
    setKeepsakeOptions((current) => ({
      ...current,
      photoTransforms: {
        ...current.photoTransforms,
        [photoId]: {
          scale: 1,
          x: 0,
          y: 0,
          ...current.photoTransforms[photoId],
          ...patch
        }
      }
    }));
  };

  const updatePhotoTransform = (patch: Partial<GameMemoryPhotoTransform>) => {
    if (activePhotoId) updatePhotoTransformFor(activePhotoId, patch);
  };

  const startPhotoDrag = (event: ReactPointerEvent<HTMLButtonElement>, photoId: NonNullable<typeof activePhotoId>) => {
    const transform = keepsakeOptions.photoTransforms[photoId];
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setActivePhotoId(photoId);
    photoDragRef.current = {
      photoId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: transform?.x ?? 0,
      initialY: transform?.y ?? 0
    };
  };

  const movePhotoDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = photoDragRef.current;
    if (!drag) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = (value: number) => Math.min(1, Math.max(-1, value));
    updatePhotoTransformFor(drag.photoId, {
      x: clamp(drag.initialX - (event.clientX - drag.startX) / Math.max(1, rect.width / 2)),
      y: clamp(drag.initialY - (event.clientY - drag.startY) / Math.max(1, rect.height / 2))
    });
  };

  const endPhotoDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    photoDragRef.current = null;
  };

  const updateStickerTransform = (sticker: GameMemoryKeepsakeSticker, patch: Partial<GameMemoryStickerTransform>) => {
    setKeepsakeOptions((current) => ({
      ...current,
      stickerTransforms: {
        ...current.stickerTransforms,
        [sticker]: {
          ...defaultGameMemoryKeepsakeOptions.stickerTransforms[sticker]!,
          ...current.stickerTransforms[sticker],
          ...patch
        }
      }
    }));
  };

  const updateTextSticker = (patch: Partial<GameMemoryTextSticker>) => {
    setKeepsakeOptions((current) => ({
      ...current,
      textSticker: { ...current.textSticker, ...patch }
    }));
  };

  const startStickerDrag = (event: ReactPointerEvent<HTMLButtonElement>, sticker: GameMemoryKeepsakeSticker) => {
    const transform = keepsakeOptions.stickerTransforms[sticker]
      ?? defaultGameMemoryKeepsakeOptions.stickerTransforms[sticker]!;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setActiveSticker(sticker);
    setTextStickerSelected(false);
    stickerDragRef.current = {
      sticker,
      startX: event.clientX,
      startY: event.clientY,
      initialX: transform.x,
      initialY: transform.y
    };
  };

  const moveStickerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = stickerDragRef.current;
    const preview = event.currentTarget.closest(".game-memory-album__preview");
    if (!drag || !preview) return;
    event.preventDefault();
    const rect = preview.getBoundingClientRect();
    const clamp = (value: number) => Math.min(0.96, Math.max(0.04, value));
    updateStickerTransform(drag.sticker, {
      x: clamp(drag.initialX + (event.clientX - drag.startX) / Math.max(1, rect.width)),
      y: clamp(drag.initialY + (event.clientY - drag.startY) / Math.max(1, rect.height))
    });
  };

  const endStickerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    stickerDragRef.current = null;
  };

  const startTextStickerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setActiveSticker(null);
    setTextStickerSelected(true);
    textStickerDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      initialX: keepsakeOptions.textSticker.x,
      initialY: keepsakeOptions.textSticker.y
    };
  };

  const moveTextStickerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = textStickerDragRef.current;
    const preview = event.currentTarget.closest(".game-memory-album__preview");
    if (!drag || !preview) return;
    event.preventDefault();
    const rect = preview.getBoundingClientRect();
    const clamp = (value: number) => Math.min(0.92, Math.max(0.08, value));
    updateTextSticker({
      x: clamp(drag.initialX + (event.clientX - drag.startX) / Math.max(1, rect.width)),
      y: clamp(drag.initialY + (event.clientY - drag.startY) / Math.max(1, rect.height))
    });
  };

  const endTextStickerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    textStickerDragRef.current = null;
  };

  const movePhoto = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= orderedPhotos.length) return;
    const next = orderedPhotos.map(({ photoSpotId }) => photoSpotId);
    [next[index], next[target]] = [next[target]!, next[index]!];
    setKeepsakeOptions((current) => ({ ...current, photoOrder: next }));
  };

  const toggleSticker = (sticker: GameMemoryKeepsakeSticker) => {
    setActiveSticker(sticker);
    setKeepsakeOptions((current) => ({
      ...current,
      stickers: current.stickers.includes(sticker)
        ? current.stickers.filter((candidate) => candidate !== sticker)
        : [...current.stickers, sticker].slice(-3)
    }));
  };

  const saveCurrentTemplate = () => {
    if (keepsakeTemplates.length >= 3) {
      setTemplateStatus("템플릿은 최대 3개까지 저장할 수 있어요.");
      return;
    }
    const template = createGameMemoryKeepsakeTemplate(keepsakeOptions, keepsakeTemplates.length);
    setKeepsakeTemplates((current) => [...current, template]);
    setTemplateStatus(`${template.name}을 저장했어요.`);
  };

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

  const buildPrintKeepsake = async (format: GameMemoryKeepsakePrintFormat, output: "png" | "pdf") => {
    if (!hasMemories || busy) return;
    setKeepsakeStatus("printing");
    try {
      if (output === "pdf") {
        const duplex = format === "postcard" && postcardDuplex;
        const blob = await createGameMemoryKeepsakePdf(keepsakeData, format, { vendor: printVendor, duplex });
        saveGameMemoryKeepsakePdf(blob, nickname, format, undefined, duplex);
        setKeepsakeStatus(format === "a4" ? "printed-pdf-a4" : "printed-pdf-postcard");
      } else {
        const blob = await createGameMemoryKeepsakePrint(keepsakeData, format, printVendor);
        saveGameMemoryKeepsakePrint(blob, nickname, format);
        setKeepsakeStatus(format === "a4" ? "printed-a4" : "printed-postcard");
      }
    } catch {
      setKeepsakeStatus("error");
    }
  };

  const keepsakeStatusLabel = keepsakeStatus === "saving" ? "추억 이미지를 만들고 있어요."
    : keepsakeStatus === "saved" ? "추억 이미지를 기기에 저장했어요."
      : keepsakeStatus === "sharing" ? "공유 이미지를 준비하고 있어요."
        : keepsakeStatus === "printing" ? "300dpi 인쇄용 이미지를 만들고 있어요."
          : keepsakeStatus === "printed-a4" ? "A4 인쇄용 PNG를 저장했어요."
            : keepsakeStatus === "printed-postcard" ? "4×6 엽서 인쇄용 PNG를 저장했어요."
              : keepsakeStatus === "printed-pdf-a4" ? "A4 인쇄용 PDF를 저장했어요."
                : keepsakeStatus === "printed-pdf-postcard" ? `4×6 엽서 ${postcardDuplex ? "양면 " : ""}인쇄용 PDF를 저장했어요.`
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
        <div className="game-memory-album__editor">
          <div
            className="game-memory-album__preview"
            data-layout={keepsakeOptions.layout}
            data-frame={keepsakeOptions.frame}
            aria-label="포토스트립 미리보기"
          >
            <small>{formatCoupleNames(event, coupleOrder)}</small>
            <div className="game-memory-album__preview-photos">
              {orderedPhotos.slice(0, 3).map((photo) => (
                <button
                  key={photo.photoSpotId}
                  type="button"
                  aria-label={`${photo.spotLabel} 사진 자르기 선택`}
                  aria-pressed={activePhotoId === photo.photoSpotId}
                  onClick={() => setActivePhotoId(photo.photoSpotId)}
                  onPointerDown={(event) => startPhotoDrag(event, photo.photoSpotId)}
                  onPointerMove={movePhotoDrag}
                  onPointerUp={endPhotoDrag}
                  onPointerCancel={endPhotoDrag}
                >
                  <span>
                    <img
                      src={photo.dataUrl}
                      alt=""
                      style={{
                        transform: `translate(${-(keepsakeOptions.photoTransforms[photo.photoSpotId]?.x ?? 0) * 18}%, ${-(keepsakeOptions.photoTransforms[photo.photoSpotId]?.y ?? 0) * 18}%) scale(${keepsakeOptions.photoTransforms[photo.photoSpotId]?.scale ?? 1})`
                      }}
                    />
                  </span>
                </button>
              ))}
              {Array.from({ length: Math.max(0, 3 - orderedPhotos.length) }, (_, index) => (
                <span key={`empty-${index}`}><Camera aria-hidden="true" /></span>
              ))}
            </div>
            <strong>{keepsakeOptions.message}</strong>
            <div className="game-memory-album__preview-stickers" aria-label="자유 배치 스티커">
              {keepsakeOptions.stickers.map((sticker) => {
                const transform = keepsakeOptions.stickerTransforms[sticker]
                  ?? defaultGameMemoryKeepsakeOptions.stickerTransforms[sticker]!;
                const Icon = sticker === "heart" ? Heart
                  : sticker === "flower" ? Flower2
                    : sticker === "sparkle" ? Sparkles
                      : sticker === "dove" ? Bird
                        : sticker === "ring" ? Gem : Leaf;
                const label = sticker === "heart" ? "하트"
                  : sticker === "flower" ? "꽃"
                    : sticker === "sparkle" ? "별빛"
                      : sticker === "dove" ? "비둘기"
                        : sticker === "ring" ? "반지" : "잎사귀";
                return (
                  <button
                    key={sticker}
                    type="button"
                    aria-label={`${label} 스티커 위치 조절`}
                    aria-pressed={activeSticker === sticker}
                    style={{
                      left: `${transform.x * 100}%`,
                      top: `${transform.y * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.scale})`
                    }}
                    onClick={() => setActiveSticker(sticker)}
                    onPointerDown={(event) => startStickerDrag(event, sticker)}
                    onPointerMove={moveStickerDrag}
                    onPointerUp={endStickerDrag}
                    onPointerCancel={endStickerDrag}
                  ><Icon aria-hidden="true" /></button>
                );
              })}
              {keepsakeOptions.textSticker.enabled ? (
                <button
                  type="button"
                  className="game-memory-album__preview-text-sticker"
                  aria-label="문구 스티커 위치 조절"
                  aria-pressed={textStickerSelected}
                  style={{
                    left: `${keepsakeOptions.textSticker.x * 100}%`,
                    top: `${keepsakeOptions.textSticker.y * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${keepsakeOptions.textSticker.rotation}deg) scale(${keepsakeOptions.textSticker.scale})`
                  }}
                  onPointerDown={startTextStickerDrag}
                  onPointerMove={moveTextStickerDrag}
                  onPointerUp={endTextStickerDrag}
                  onPointerCancel={endTextStickerDrag}
                >{keepsakeOptions.textSticker.text}</button>
              ) : null}
            </div>
          </div>

          {activePhotoId ? (
            <fieldset className="game-memory-album__crop-editor">
              <legend><Crop aria-hidden="true" />사진 자르기·자유 배치</legend>
              <p><Move aria-hidden="true" />사진을 직접 끌거나 확대와 중심 슬라이더를 조절하세요.</p>
              <label>
                <span>확대</span>
                <input
                  type="range"
                  min="1"
                  max="2.2"
                  step="0.05"
                  aria-label="선택 사진 확대"
                  value={keepsakeOptions.photoTransforms[activePhotoId]?.scale ?? 1}
                  onChange={(event) => updatePhotoTransform({ scale: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>좌우</span>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  aria-label="선택 사진 좌우 위치"
                  value={keepsakeOptions.photoTransforms[activePhotoId]?.x ?? 0}
                  onChange={(event) => updatePhotoTransform({ x: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>상하</span>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  aria-label="선택 사진 상하 위치"
                  value={keepsakeOptions.photoTransforms[activePhotoId]?.y ?? 0}
                  onChange={(event) => updatePhotoTransform({ y: Number(event.target.value) })}
                />
              </label>
              <button type="button" onClick={() => updatePhotoTransform({ scale: 1, x: 0, y: 0 })}>
                <RotateCcw aria-hidden="true" />선택 사진 초기화
              </button>
            </fieldset>
          ) : null}

          <fieldset>
            <legend><LayoutGrid aria-hidden="true" />레이아웃</legend>
            <div className="game-memory-album__layout-options">
              {([
                ["classic", "클래식"],
                ["garden", "가든"],
                ["film", "필름"]
              ] as const satisfies readonly [GameMemoryKeepsakeLayout, string][]).map(([layout, label]) => (
                <button
                  key={layout}
                  type="button"
                  aria-pressed={keepsakeOptions.layout === layout}
                  onClick={() => setKeepsakeOptions((current) => ({ ...current, layout }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend><Frame aria-hidden="true" />사진 프레임</legend>
            <div className="game-memory-album__layout-options">
              {([[
                "clean", "깔끔"
              ], [
                "rounded", "소프트"
              ], [
                "postage", "우표"
              ]] as const satisfies readonly [GameMemoryKeepsakeFrame, string][]).map(([frame, label]) => (
                <button
                  key={frame}
                  type="button"
                  aria-pressed={keepsakeOptions.frame === frame}
                  onClick={() => setKeepsakeOptions((current) => ({ ...current, frame }))}
                >{label}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend><Sparkles aria-hidden="true" />장식 스티커</legend>
            <div className="game-memory-album__sticker-options">
              {([[
                "heart", "하트", Heart
              ], [
                "flower", "꽃", Flower2
              ], [
                "sparkle", "별빛", Sparkles
              ], [
                "dove", "비둘기", Bird
              ], [
                "ring", "반지", Gem
              ], [
                "leaf", "잎사귀", Leaf
              ]] as const).map(([sticker, label, Icon]) => (
                <button
                  key={sticker}
                  type="button"
                  aria-label={`${label} 스티커`}
                  aria-pressed={keepsakeOptions.stickers.includes(sticker)}
                  onClick={() => toggleSticker(sticker)}
                ><Icon aria-hidden="true" /><span>{label}</span></button>
              ))}
            </div>
          </fieldset>

          <fieldset className="game-memory-album__text-sticker-editor">
            <legend><MessageSquareText aria-hidden="true" />나만의 문구 스티커</legend>
            <div className="game-memory-album__text-sticker-row">
              <input
                aria-label="문구 스티커 내용"
                maxLength={18}
                value={keepsakeOptions.textSticker.text}
                onFocus={() => {
                  setActiveSticker(null);
                  setTextStickerSelected(true);
                }}
                onChange={(event) => updateTextSticker({ text: event.target.value })}
              />
              <button
                type="button"
                aria-pressed={keepsakeOptions.textSticker.enabled}
                onClick={() => {
                  updateTextSticker({ enabled: !keepsakeOptions.textSticker.enabled });
                  setActiveSticker(null);
                  setTextStickerSelected(true);
                }}
              >{keepsakeOptions.textSticker.enabled ? "사용 중" : "추가"}</button>
            </div>
            {keepsakeOptions.textSticker.enabled && textStickerSelected ? (
              <div className="game-memory-album__text-sticker-controls">
                <label>
                  <span><Scaling aria-hidden="true" />크기</span>
                  <input
                    type="range"
                    min="0.65"
                    max="1.8"
                    step="0.05"
                    aria-label="문구 스티커 크기"
                    value={keepsakeOptions.textSticker.scale}
                    onChange={(event) => updateTextSticker({ scale: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span><RotateCw aria-hidden="true" />회전</span>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="3"
                    aria-label="문구 스티커 회전"
                    value={keepsakeOptions.textSticker.rotation}
                    onChange={(event) => updateTextSticker({ rotation: Number(event.target.value) })}
                  />
                </label>
                <button type="button" onClick={() => updateTextSticker(defaultGameMemoryKeepsakeOptions.textSticker)}>
                  <RotateCcw aria-hidden="true" />문구 배치 초기화
                </button>
              </div>
            ) : null}
          </fieldset>

          {activeSticker && keepsakeOptions.stickers.includes(activeSticker) ? (
            <fieldset className="game-memory-album__sticker-editor">
              <legend><Move aria-hidden="true" />스티커 자유 배치·회전</legend>
              <p>미리보기에서 스티커를 직접 끌어 원하는 위치에 놓으세요.</p>
              <label>
                <span><Scaling aria-hidden="true" />크기</span>
                <input
                  type="range"
                  min="0.65"
                  max="1.8"
                  step="0.05"
                  aria-label="선택 스티커 크기"
                  value={keepsakeOptions.stickerTransforms[activeSticker]?.scale ?? 1}
                  onChange={(event) => updateStickerTransform(activeSticker, { scale: Number(event.target.value) })}
                />
              </label>
              <label>
                <span><RotateCw aria-hidden="true" />회전</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  aria-label="선택 스티커 회전"
                  value={keepsakeOptions.stickerTransforms[activeSticker]?.rotation ?? 0}
                  onChange={(event) => updateStickerTransform(activeSticker, { rotation: Number(event.target.value) })}
                />
              </label>
              <button
                type="button"
                onClick={() => updateStickerTransform(
                  activeSticker,
                  defaultGameMemoryKeepsakeOptions.stickerTransforms[activeSticker]!
                )}
              ><RotateCcw aria-hidden="true" />선택 스티커 초기화</button>
            </fieldset>
          ) : null}

          <fieldset className="game-memory-album__templates">
            <legend><Save aria-hidden="true" />내 포토스트립 템플릿</legend>
            <div>
              {keepsakeTemplates.map((template) => (
                <span key={template.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setKeepsakeOptions((current) => applyGameMemoryKeepsakeTemplate(current, template));
                      setTemplateStatus(`${template.name}을 적용했어요.`);
                    }}
                  >{template.name}</button>
                  <button
                    type="button"
                    aria-label={`${template.name} 삭제`}
                    title="템플릿 삭제"
                    onClick={() => {
                      setKeepsakeTemplates((current) => current.filter(({ id }) => id !== template.id));
                      setTemplateStatus(`${template.name}을 삭제했어요.`);
                    }}
                  ><Trash2 aria-hidden="true" /></button>
                </span>
              ))}
              <button type="button" disabled={keepsakeTemplates.length >= 3} onClick={saveCurrentTemplate}>
                <Save aria-hidden="true" />현재 디자인 저장
              </button>
            </div>
            <p aria-live="polite">{templateStatus || "레이아웃·프레임·스티커 배치를 최대 3개까지 저장합니다."}</p>
          </fieldset>

          <fieldset>
            <legend><Download aria-hidden="true" />저장 화질</legend>
            <div className="game-memory-album__layout-options">
              <button
                type="button"
                aria-pressed={keepsakeOptions.quality === "standard"}
                onClick={() => setKeepsakeOptions((current) => ({ ...current, quality: "standard" }))}
              >일반</button>
              <button
                type="button"
                aria-pressed={keepsakeOptions.quality === "high"}
                onClick={() => setKeepsakeOptions((current) => ({ ...current, quality: "high" }))}
              >고화질 2배</button>
            </div>
          </fieldset>

          <label>
            <span><MessageSquareText aria-hidden="true" />한 줄 문구</span>
            <input
              value={keepsakeOptions.message}
              maxLength={48}
              onChange={(event) => setKeepsakeOptions((current) => ({
                ...current,
                message: event.target.value || defaultGameMemoryKeepsakeOptions.message
              }))}
            />
          </label>

          {orderedPhotos.length > 1 ? (
            <ol className="game-memory-album__photo-order" aria-label="사진 순서">
              {orderedPhotos.slice(0, 3).map((photo, index) => (
                <li key={photo.photoSpotId}>
                  <img src={photo.dataUrl} alt={`${index + 1}번째 ${photo.spotLabel}`} />
                  <span>{index + 1}. {photo.spotLabel}</span>
                  <button
                    type="button"
                    aria-label={`${photo.spotLabel} 앞으로 이동`}
                    title="앞으로 이동"
                    disabled={index === 0}
                    onClick={() => movePhoto(index, -1)}
                  ><ArrowLeft aria-hidden="true" /></button>
                  <button
                    type="button"
                    aria-label={`${photo.spotLabel} 뒤로 이동`}
                    title="뒤로 이동"
                    disabled={index === Math.min(orderedPhotos.length, 3) - 1}
                    onClick={() => movePhoto(index, 1)}
                  ><ArrowRight aria-hidden="true" /></button>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        <div className="game-memory-album__keepsake-actions">
          <button type="button" disabled={!hasMemories || busy} onClick={() => void buildKeepsake("save")}><Download aria-hidden="true" />저장</button>
          <button type="button" disabled={!hasMemories || busy} onClick={() => void buildKeepsake("share")}><Send aria-hidden="true" />공유</button>
        </div>
        <div className="game-memory-album__print-format" role="group" aria-label="인쇄 미리보기 크기">
          <button type="button" aria-pressed={printPreviewFormat === "a4"} onClick={() => { setPrintPreviewFormat("a4"); setPrintPreviewSide("front"); }}>A4</button>
          <button type="button" aria-pressed={printPreviewFormat === "postcard"} onClick={() => setPrintPreviewFormat("postcard")}>4×6</button>
        </div>
        <div className="game-memory-album__print-vendors" role="group" aria-label="인화 업체 규격">
          {(Object.entries(gameMemoryKeepsakePrintVendorProfiles) as Array<[GameMemoryKeepsakePrintVendor, (typeof gameMemoryKeepsakePrintVendorProfiles)[GameMemoryKeepsakePrintVendor]]>).map(([vendor, profile]) => (
            <button key={vendor} type="button" aria-pressed={printVendor === vendor} title={profile.note} onClick={() => setPrintVendor(vendor)}>
              <strong>{profile.label}</strong><small>{profile.note}</small>
            </button>
          ))}
        </div>
        {printPreviewFormat === "postcard" ? (
          <div className="game-memory-album__print-sides">
            <div role="group" aria-label="엽서 미리보기 면">
              <button type="button" aria-pressed={printPreviewSide === "front"} onClick={() => setPrintPreviewSide("front")}>앞면</button>
              <button type="button" aria-pressed={printPreviewSide === "back"} onClick={() => setPrintPreviewSide("back")}>뒷면</button>
            </div>
            <label><input type="checkbox" checked={postcardDuplex} onChange={(event) => setPostcardDuplex(event.target.checked)} />양면 PDF</label>
          </div>
        ) : null}
        <div className="game-memory-album__print-preview" data-format={printPreviewFormat} data-side={printPreviewSide} aria-label={`${printPreviewFormat === "a4" ? "A4" : "4×6 엽서"} ${printPreviewSide === "back" ? "뒷면 " : ""}재단 미리보기`}>
          {printPreviewSide === "back" && printPreviewFormat === "postcard" ? (
            <div className="game-memory-album__postcard-back" style={{
              left: `${printGuide.trim.x * 100}%`,
              top: `${printGuide.trim.y * 100}%`,
              width: `${printGuide.trim.width * 100}%`,
              height: `${printGuide.trim.height * 100}%`
            }}>
              <span><strong>{formatCoupleNames(event, coupleOrder)}</strong><small>{keepsakeOptions.message}</small></span>
              <i />
              <span className="game-memory-album__postcard-address"><b>STAMP</b><em /><em /><em /><em /></span>
            </div>
          ) : (
            <div
              className="game-memory-album__print-preview-art"
              style={{
                left: `${printGuide.trim.x * 100}%`,
                top: `${printGuide.trim.y * 100}%`,
                width: `${printGuide.trim.width * 100}%`,
                height: `${printGuide.trim.height * 100}%`
              }}
            >
              <strong>{formatCoupleNames(event, coupleOrder)}</strong>
              <div>{orderedPhotos.slice(0, 3).map((photo) => (
                <img key={photo.photoSpotId} src={photo.dataUrl} alt="" />
              ))}</div>
              <span>{keepsakeOptions.message}</span>
            </div>
          )}
          <span
            className="game-memory-album__print-trim"
            style={{
              left: `${printGuide.trim.x * 100}%`,
              top: `${printGuide.trim.y * 100}%`,
              width: `${printGuide.trim.width * 100}%`,
              height: `${printGuide.trim.height * 100}%`
            }}
          >재단선</span>
          <span
            className="game-memory-album__print-safe"
            style={{
              left: `${printGuide.safe.x * 100}%`,
              top: `${printGuide.safe.y * 100}%`,
              width: `${printGuide.safe.width * 100}%`,
              height: `${printGuide.safe.height * 100}%`
            }}
          >안전영역</span>
        </div>
        <div className="game-memory-album__print-actions" role="group" aria-label="인쇄용 포토스트립 내보내기">
          <button type="button" disabled={!hasMemories || busy} onClick={() => void buildPrintKeepsake("a4", "pdf")}>
            <Printer aria-hidden="true" />A4 PDF
          </button>
          <button type="button" disabled={!hasMemories || busy} onClick={() => void buildPrintKeepsake("postcard", "pdf")}>
            <Printer aria-hidden="true" />엽서 PDF
          </button>
          <button type="button" disabled={!hasMemories || busy} onClick={() => void buildPrintKeepsake("a4", "png")}>
            <Download aria-hidden="true" />A4 PNG
          </button>
          <button type="button" disabled={!hasMemories || busy} onClick={() => void buildPrintKeepsake("postcard", "png")}>
            <Download aria-hidden="true" />엽서 PNG
          </button>
        </div>
        <small className="game-memory-album__print-note">300dpi · {gameMemoryKeepsakePrintVendorProfiles[printVendor].label} 규격 · 재단/안전영역 포함</small>
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
