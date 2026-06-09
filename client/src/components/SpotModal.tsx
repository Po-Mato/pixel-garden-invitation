import { invitationContent, type SpotId } from "@wedding-game/shared";
import { submitGuestbook, submitRsvp } from "../api/weddingApi";
import { BottomSheet } from "./BottomSheet";
import { GuestbookPanel } from "./GuestbookPanel";
import { RsvpForm } from "./RsvpForm";

type SpotModalProps = {
  spotId: SpotId;
  nickname: string;
  onClose: () => void;
};

export function SpotModal({ spotId, nickname, onClose }: SpotModalProps) {
  const spot = invitationContent.spots.find((item) => item.id === spotId);

  if (!spot) {
    return null;
  }

  return (
    <BottomSheet title={spot.title} onClose={onClose}>
      <p>{spot.body}</p>
      {spotId === "rsvp" && <RsvpForm onSubmit={submitRsvp} />}
      {spotId === "guestbook" && <GuestbookPanel nickname={nickname} messages={[]} onSubmit={submitGuestbook} />}
    </BottomSheet>
  );
}
