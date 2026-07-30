import { Download, Image as ImageIcon, Map, MoveHorizontal, MoveVertical, Palette, RotateCcw, Send, Type, ZoomIn } from "lucide-react";
import { useMemo, useState } from "react";
import { formatEventDate, formatEventStartTime, formatVenueLabel } from "../invitation/calendarEvent";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { invitationPublicUrl } from "../invitation/shareInvitation";
import { journeyCheckpoints, type JourneyProgress } from "../game/journeyProgress";
import {
  journeyKeepsakeThemeLabels,
  saveJourneyKeepsake,
  shareJourneyKeepsake,
  type JourneyKeepsakeData,
  type JourneyKeepsakeTheme
} from "../game/journeyKeepsake";
import { journeyVisitDurationLabel, loadJourneyVisits } from "../game/journeyVisitLog";
import { gardenWorld, getWorldZone } from "../game/world";
import { loadWeddingPhotoAlbum } from "../game/weddingPhoto";
import { loadWorldSecretCollection } from "../game/worldSecretCollection";
import { totalWorldSecrets } from "../game/worldPropInteractions";
import { loadWorldTravelHistory, worldTravelTimelineStops } from "../game/worldTravelHistory";
import {
  commitPhotoFrameHistory,
  createPhotoFrameHistory,
  defaultPhotoFrameTransform,
  defaultPhotoStickerStyle,
  defaultPhotoStickerTransform,
  redoPhotoFrameHistory,
  undoPhotoFrameHistory,
  type PhotoCompositionTemplate,
  type PhotoFrameTransform,
  type PhotoStickerStyle,
  type PhotoStickerTransform
} from "../game/photoFrameEditor";
import { PhotoCompositionTemplateControls, PhotoStickerTransformControls } from "./PhotoCompositionTemplateControls";
import { PhotoFrameActionControls } from "./PhotoFrameActionControls";
import { PhotoFrameTouchEditor } from "./PhotoFrameTouchEditor";
import { PhotoStickerStyleControls } from "./PhotoStickerStyleControls";

type JourneyMemoryCardAccessProps = {
  nickname: string;
  progress: JourneyProgress;
};

type CardStatus = "idle" | "saving" | "saved" | "sharing" | "shared" | "fallback" | "error";

function resolveAssetUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return new URL(path, document.baseURI).href;
}

export function JourneyMemoryCardAccess({ nickname, progress }: JourneyMemoryCardAccessProps) {
  const { event, content } = usePublishedInvitationContent();
  const coupleOrder = useCoupleOrder();
  const [status, setStatus] = useState<CardStatus>("idle");
  const [theme, setTheme] = useState<JourneyKeepsakeTheme>("garden");
  const photoOptions = useMemo(() => {
    const album = [...loadWeddingPhotoAlbum().photos]
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((photo) => ({ id: `album:${photo.photoSpotId}`, label: photo.spotLabel, url: photo.dataUrl }));
    const gallery = content.gallery.slice(-3).reverse().map((photo) => ({ id: `gallery:${photo.id}`, label: photo.alt, url: resolveAssetUrl(photo.assetPath) }));
    return [...album, ...gallery].slice(0, 4);
  }, [content.gallery]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [photoHistory, setPhotoHistory] = useState(() => createPhotoFrameHistory());
  const [stickerText, setStickerText] = useState("");
  const [stickerStyle, setStickerStyle] = useState<PhotoStickerStyle>(defaultPhotoStickerStyle);
  const [stickerTransform, setStickerTransform] = useState<PhotoStickerTransform>(defaultPhotoStickerTransform);
  const photoTransform = photoHistory.current;
  const updatePhotoTransform = (value: PhotoFrameTransform) => setPhotoHistory((current) => commitPhotoFrameHistory(current, value));
  const selectedPhotoOption = photoOptions.find(({ id }) => id === selectedPhotoId) ?? photoOptions[0];
  const busy = status === "saving" || status === "sharing";
  const data = useMemo<JourneyKeepsakeData>(() => {
    const photoAlbum = loadWeddingPhotoAlbum();
    const visits = loadJourneyVisits();
    const travelHistory = loadWorldTravelHistory("home");
    const secrets = loadWorldSecretCollection();
    return {
      guestName: nickname,
      coupleNames: formatCoupleNames(event, coupleOrder),
      dateLabel: formatEventDate(event),
      timeLabel: formatEventStartTime(event),
      venueLabel: formatVenueLabel(event),
      checkpointLabels: journeyCheckpoints.map(({ label }) => label),
      checkpointStates: journeyCheckpoints.map(({ id, label }) => ({ label, complete: progress.completedIds.includes(id) })),
      photoUrl: selectedPhotoOption.url,
      publicUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? invitationPublicUrl,
      visitSummary: `${progress.completedIds.length}곳 · ${journeyVisitDurationLabel(visits)}`,
      photoCount: photoAlbum.photos.length,
      travelLabels: worldTravelTimelineStops(travelHistory, 5).map(({ zoneId }) => getWorldZone(gardenWorld, zoneId).label),
      secretCount: secrets.discoveredIds.length,
      totalSecretCount: totalWorldSecrets,
      theme,
      photoTransform,
      stickerText,
      stickerStyle,
      stickerTransform
    };
  }, [coupleOrder, event, nickname, photoTransform, progress.completedIds, selectedPhotoOption.url, stickerStyle, stickerText, stickerTransform, theme]);

  const applyTemplate = (template: PhotoCompositionTemplate) => {
    updatePhotoTransform(template.photoTransform);
    setStickerText(template.stickerText);
    setStickerStyle(template.stickerStyle);
    setStickerTransform(template.stickerTransform);
  };

  const save = async () => {
    setStatus("saving");
    try {
      await saveJourneyKeepsake(data);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const share = async () => {
    setStatus("sharing");
    try {
      setStatus(await shareJourneyKeepsake(data) === "shared" ? "shared" : "fallback");
    } catch {
      setStatus("error");
    }
  };

  const statusLabel = status === "saved" ? "중간 여정 카드를 저장했어요"
    : status === "shared" ? "공유 앱으로 여정 카드를 보냈어요"
      : status === "fallback" ? "공유를 지원하지 않아 이미지로 저장했어요"
        : status === "error" ? "카드를 만들지 못했어요"
          : busy ? "여정 카드를 준비하고 있어요" : "완주 전에도 현재 여정을 남길 수 있어요";

  return (
    <section className="journey-memory-card-access" aria-label="중간 여정 카드">
      <header><span><Map aria-hidden="true" />중간 여정 카드</span><strong>{progress.completedIds.length}/{journeyCheckpoints.length}</strong></header>
      <p>{statusLabel}</p>
      <details className="journey-memory-card-access__editor">
        <summary><Palette aria-hidden="true" />카드 꾸미기</summary>
        <div className="journey-memory-card-access__themes" aria-label="여정 카드 테마">
          <span><Palette aria-hidden="true" />테마</span>
          {(Object.keys(journeyKeepsakeThemeLabels) as JourneyKeepsakeTheme[]).map((candidate) => (
            <button key={candidate} type="button" data-theme={candidate} aria-pressed={theme === candidate} onClick={() => setTheme(candidate)}>{journeyKeepsakeThemeLabels[candidate]}</button>
          ))}
        </div>
        <PhotoCompositionTemplateControls photoTransform={photoTransform} stickerText={stickerText} stickerStyle={stickerStyle} stickerTransform={stickerTransform} onApply={applyTemplate} />
        <div className="journey-memory-card-access__photos" aria-label="여정 카드 대표 사진">
          <span><ImageIcon aria-hidden="true" />대표 사진</span>
          {photoOptions.map((photo) => (
            <button key={photo.id} type="button" aria-label={`${photo.label} 대표 사진 선택`} aria-pressed={(selectedPhotoId ?? photoOptions[0]?.id) === photo.id} onClick={() => setSelectedPhotoId(photo.id)}><img src={photo.url} alt="" /></button>
          ))}
        </div>
        <div className="journey-memory-card-access__crop" aria-label="대표 사진 초점 편집">
          <PhotoFrameTouchEditor src={selectedPhotoOption.url} alt="" transform={photoTransform} onChange={updatePhotoTransform} ariaLabel="대표 사진 직접 구도 편집" />
          <PhotoFrameActionControls value={photoTransform} onChange={updatePhotoTransform} canUndo={photoHistory.past.length > 0} canRedo={photoHistory.future.length > 0} onUndo={() => setPhotoHistory(undoPhotoFrameHistory)} onRedo={() => setPhotoHistory(redoPhotoFrameHistory)} />
          <label><ZoomIn aria-hidden="true" /><span>확대</span><input type="range" min="1" max="1.6" step="0.05" value={photoTransform.zoom} onChange={(event) => updatePhotoTransform({ ...photoTransform, zoom: Number(event.target.value) })} /></label>
          <label><MoveHorizontal aria-hidden="true" /><span>좌우</span><input type="range" min="-1" max="1" step="0.1" value={photoTransform.offsetX} onChange={(event) => updatePhotoTransform({ ...photoTransform, offsetX: Number(event.target.value) })} /></label>
          <label><MoveVertical aria-hidden="true" /><span>상하</span><input type="range" min="-1" max="1" step="0.1" value={photoTransform.offsetY} onChange={(event) => updatePhotoTransform({ ...photoTransform, offsetY: Number(event.target.value) })} /></label>
          <button type="button" aria-label="대표 사진 초점 초기화" title="초점 초기화" onClick={() => updatePhotoTransform(defaultPhotoFrameTransform)}><RotateCcw aria-hidden="true" /></button>
        </div>
        <label className="journey-memory-card-access__sticker"><Type aria-hidden="true" /><span>짧은 문구</span><input value={stickerText} maxLength={24} placeholder="예: 오래 행복하세요" onChange={(event) => setStickerText(event.target.value)} /></label>
        <PhotoStickerStyleControls value={stickerStyle} onChange={setStickerStyle} />
        <PhotoStickerTransformControls value={stickerTransform} onChange={setStickerTransform} />
      </details>
      <div className="journey-memory-card-access__actions">
        <button type="button" disabled={busy || progress.completedIds.length === 0} onClick={() => void save()}><Download aria-hidden="true" />저장</button>
        <button type="button" disabled={busy || progress.completedIds.length === 0} onClick={() => void share()}><Send aria-hidden="true" />공유</button>
      </div>
    </section>
  );
}
