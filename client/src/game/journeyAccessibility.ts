import type { JourneyCheckpoint, JourneyCheckpointId } from "./journeyProgress";

const quickSectionByCheckpoint: Record<JourneyCheckpointId, string> = {
  directions: "directions",
  gallery: "gallery",
  bride: "couple",
  ceremony: "schedule",
  guestbook: "guestbook"
};

export function quickInvitationSectionForCheckpoint(
  checkpoint: Pick<JourneyCheckpoint, "id">
): string {
  return quickSectionByCheckpoint[checkpoint.id];
}

export function quickInvitationHashForCheckpoint(
  checkpoint: Pick<JourneyCheckpoint, "id">
): `#${string}` {
  return `#${quickInvitationSectionForCheckpoint(checkpoint)}`;
}
