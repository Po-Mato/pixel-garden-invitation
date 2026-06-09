import { invitationContent, type SpotId } from "@wedding-game/shared";
import { BottomSheet } from "./BottomSheet";

type SpotModalProps = {
  spotId: SpotId;
  onClose: () => void;
};

export function SpotModal({ spotId, onClose }: SpotModalProps) {
  const spot = invitationContent.spots.find((candidate) => candidate.id === spotId);

  if (!spot) {
    return null;
  }

  return (
    <BottomSheet title={spot.title} onClose={onClose}>
      <p>{spot.body}</p>
    </BottomSheet>
  );
}
