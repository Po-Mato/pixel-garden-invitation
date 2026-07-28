import {
  journeyCheckpoints,
  type JourneyCheckpointId,
  type JourneyProgress
} from "./journeyProgress";

export type JourneyArrivalAction = {
  completedLabel: string;
  nextCheckpointId: JourneyCheckpointId;
  nextLabel: string;
  detail: string;
};

export function journeyArrivalAction(
  progress: JourneyProgress,
  completedId: JourneyCheckpointId,
  plannedIds: readonly JourneyCheckpointId[]
): JourneyArrivalAction | null {
  const completed = new Set(progress.completedIds);
  const remaining = [
    ...plannedIds,
    ...journeyCheckpoints.map(({ id }) => id)
  ].find((id, index, all) => !completed.has(id) && all.indexOf(id) === index);
  if (!remaining) return null;

  const completedCheckpoint = journeyCheckpoints.find(({ id }) => id === completedId);
  const nextCheckpoint = journeyCheckpoints.find(({ id }) => id === remaining);
  if (!completedCheckpoint || !nextCheckpoint) return null;

  return {
    completedLabel: completedCheckpoint.label,
    nextCheckpointId: nextCheckpoint.id,
    nextLabel: nextCheckpoint.label,
    detail: completedId === "ceremony" && nextCheckpoint.id === "guestbook"
      ? "연회장으로 이동해 축하 메시지를 남겨보세요"
      : nextCheckpoint.detail
  };
}
