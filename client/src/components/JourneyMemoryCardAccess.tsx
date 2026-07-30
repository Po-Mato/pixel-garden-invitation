import { Download, Map, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { formatEventDate, formatEventStartTime, formatVenueLabel } from "../invitation/calendarEvent";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { invitationPublicUrl } from "../invitation/shareInvitation";
import { journeyCheckpoints, type JourneyProgress } from "../game/journeyProgress";
import { saveJourneyKeepsake, shareJourneyKeepsake, type JourneyKeepsakeData } from "../game/journeyKeepsake";
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
  const busy = status === "saving" || status === "sharing";
  const data = useMemo<JourneyKeepsakeData>(() => {
    const photoAlbum = loadWeddingPhotoAlbum();
    const latestPhoto = [...photoAlbum.photos].sort((left, right) => right.createdAt - left.createdAt)[0];
    const finalePhoto = content.gallery.find((photo) => photo.id === "10-sunlit-finale") ?? content.gallery.at(-1)!;
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
      photoUrl: latestPhoto?.dataUrl || resolveAssetUrl(finalePhoto.assetPath),
      publicUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? invitationPublicUrl,
      visitSummary: `${progress.completedIds.length}곳 · ${journeyVisitDurationLabel(visits)}`,
      photoCount: photoAlbum.photos.length,
      travelLabels: worldTravelTimelineStops(travelHistory, 5).map(({ zoneId }) => getWorldZone(gardenWorld, zoneId).label),
      secretCount: secrets.discoveredIds.length,
      totalSecretCount: totalWorldSecrets
    };
  }, [content.gallery, coupleOrder, event, nickname, progress.completedIds]);

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
      <div>
        <button type="button" disabled={busy || progress.completedIds.length === 0} onClick={() => void save()}><Download aria-hidden="true" />저장</button>
        <button type="button" disabled={busy || progress.completedIds.length === 0} onClick={() => void share()}><Send aria-hidden="true" />공유</button>
      </div>
    </section>
  );
}
