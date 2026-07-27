import {
  journeyCheckpoints,
  type JourneyCheckpoint,
  type JourneyCheckpointId,
  type JourneyProgress
} from "./journeyProgress";

export function remainingJourneyWaypoints(progress: JourneyProgress): JourneyCheckpoint[] {
  const completed = new Set(progress.completedIds);
  return journeyCheckpoints.filter((checkpoint) => !completed.has(checkpoint.id));
}

export function normalizeJourneyWaypointPlan(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[]
): JourneyCheckpointId[] {
  const remaining = remainingJourneyWaypoints(progress);
  const requested = new Set(checkpointIds);
  const normalized = remaining.filter((checkpoint) => requested.has(checkpoint.id)).map(({ id }) => id);
  return normalized.length > 0 ? normalized : remaining.map(({ id }) => id);
}

export function toggleJourneyWaypoint(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[],
  checkpointId: JourneyCheckpointId
): JourneyCheckpointId[] {
  const normalized = normalizeJourneyWaypointPlan(progress, checkpointIds);
  const selected = new Set(normalized);
  if (selected.has(checkpointId)) {
    if (selected.size === 1) return normalized;
    selected.delete(checkpointId);
  } else {
    selected.add(checkpointId);
  }
  return remainingJourneyWaypoints(progress)
    .filter((checkpoint) => selected.has(checkpoint.id))
    .map(({ id }) => id);
}

export function firstJourneyWaypoint(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[]
): JourneyCheckpoint | null {
  const [firstId] = normalizeJourneyWaypointPlan(progress, checkpointIds);
  return journeyCheckpoints.find((checkpoint) => checkpoint.id === firstId) ?? null;
}
