import { useEffect, useState } from "react";
import { invitationContent, type SpotId } from "@wedding-game/shared";
import {
  fetchGuestbookMessages,
  submitGuestbook,
  type GuestbookMessage,
  type GuestbookPayload
} from "../api/weddingApi";
import { BottomSheet } from "./BottomSheet";
import { CoupleProfilePanel } from "./CoupleProfilePanel";
import { GuestbookPanel } from "./GuestbookPanel";
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
  const [guestbookMessages, setGuestbookMessages] = useState<GuestbookMessage[]>([]);

  useEffect(() => {
    if (spotId !== "guestbook") {
      return;
    }

    let active = true;
    fetchGuestbookMessages()
      .then((messages) => {
        if (active) {
          setGuestbookMessages(messages);
        }
      })
      .catch(() => {
        if (active) {
          setGuestbookMessages([]);
        }
      });

    return () => {
      active = false;
    };
  }, [spotId]);

  async function handleGuestbookSubmit(payload: GuestbookPayload): Promise<void> {
    await submitGuestbook(payload);

    try {
      setGuestbookMessages(await fetchGuestbookMessages());
    } catch {
      // Submission succeeded; keep the existing success path even if refresh fails.
    }
  }

  if (!spot) {
    return null;
  }

  return (
    <BottomSheet title={spot.title} onClose={onClose}>
      <p>{spot.body}</p>
      {spotId === "rsvp" && <RsvpPanel />}
      {spotId === "guestbook" && (
        <GuestbookPanel nickname={nickname} messages={guestbookMessages} onSubmit={handleGuestbookSubmit} />
      )}
      {spotId === "couple" && <CoupleProfilePanel />}
      {spotId === "gallery" && <WeddingGallery />}
      {spotId === "story" && <WeddingStoryTimeline />}
    </BottomSheet>
  );
}
