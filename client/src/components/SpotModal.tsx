import { invitationContent, type SpotId } from "@wedding-game/shared";
import { BottomSheet } from "./BottomSheet";
import { CoupleProfilePanel } from "./CoupleProfilePanel";
import { GuestbookExperience } from "./GuestbookExperience";
import { RsvpPanel } from "./RsvpPanel";
import { WeddingGallery } from "./WeddingGallery";
import { WeddingStoryTimeline } from "./WeddingStoryTimeline";
import { useEffect } from "react";
import { trackAnalyticsContextEvent } from "../analytics/invitationAnalytics";

type SpotModalProps = {
  spotId: SpotId;
  nickname: string;
  onClose: () => void;
};

export function SpotModal({ spotId, nickname, onClose }: SpotModalProps) {
  const spot = invitationContent.spots.find((item) => item.id === spotId);

  useEffect(() => {
    if (spotId === "gallery") trackAnalyticsContextEvent("gallery_view");
    if (spotId === "rsvp") trackAnalyticsContextEvent("rsvp_view");
    if (spotId === "guestbook") trackAnalyticsContextEvent("guestbook_view");
  }, [spotId]);

  if (!spot) return null;

  return (
    <BottomSheet title={spot.title} onClose={onClose}>
      <p>{spot.body}</p>
      {spotId === "rsvp" && <RsvpPanel />}
      {spotId === "guestbook" && <GuestbookExperience nickname={nickname} />}
      {spotId === "couple" && <CoupleProfilePanel />}
      {spotId === "gallery" && <WeddingGallery />}
      {spotId === "story" && <WeddingStoryTimeline />}
    </BottomSheet>
  );
}
