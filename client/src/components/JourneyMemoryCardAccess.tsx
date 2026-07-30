import { Download, Image as ImageIcon, Map, Palette, Send } from "lucide-react";
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
  const busy = status === "saving" || status === "sharing";
  const data = useMemo<JourneyKeepsakeData>(() => {
    const photoAlbum = loadWeddingPhotoAlbum();
    const selectedPhoto = photoOptions.find(({ id }) => id === selectedPhotoId) ?? photoOptions[0];
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
      photoUrl: selectedPhoto.url,
      publicUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? invitationPublicUrl,
      visitSummary: `${progress.completedIds.length}곳 · ${journeyVisitDurationLabel(visits)}`,
      photoCount: photoAlbum.photos.length,
      travelLabels: worldTravelTimelineStops(travelHistory, 5).map(({ zoneId }) => getWorldZone(gardenWorld, zoneId).label),
      secretCount: secrets.discoveredIds.length,
      totalSecretCount: totalWorldSecrets,
      theme
    };
  }, [coupleOrder, event, nickname, photoOptions, progress.completedIds, selectedPhotoId, theme]);

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
        <div className="journey-memory-card-access__photos" aria-label="여정 카드 대표 사진">
          <span><ImageIcon aria-hidden="true" />대표 사진</span>
          {photoOptions.map((photo) => (
            <button key={photo.id} type="button" aria-label={`${photo.label} 대표 사진 선택`} aria-pressed={(selectedPhotoId ?? photoOptions[0]?.id) === photo.id} onClick={() => setSelectedPhotoId(photo.id)}><img src={photo.url} alt="" /></button>
          ))}
        </div>
      </details>
      <div className="journey-memory-card-access__actions">
        <button type="button" disabled={busy || progress.completedIds.length === 0} onClick={() => void save()}><Download aria-hidden="true" />저장</button>
        <button type="button" disabled={busy || progress.completedIds.length === 0} onClick={() => void share()}><Send aria-hidden="true" />공유</button>
      </div>
    </section>
  );
}
