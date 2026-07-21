import { invitationContent, type SpotId } from "@wedding-game/shared";
import { BottomSheet } from "./BottomSheet";
import { CoupleProfilePanel } from "./CoupleProfilePanel";
import { GuestbookExperience } from "./GuestbookExperience";
import { RsvpPanel } from "./RsvpPanel";
import { WeddingGallery } from "./WeddingGallery";
import { WeddingStoryTimeline } from "./WeddingStoryTimeline";

type SpotModalProps = {
  spotId: SpotId;
  nickname: string;
  onClose: () => void;
};

export function SpotModal({ spotId, nickname, onClose }: SpotModalProps) {
  const spot = invitationContent.spots.find((item) => item.id === spotId);
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
