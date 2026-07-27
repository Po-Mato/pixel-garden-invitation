import {
  journeyCheckpoints,
  type JourneyCheckpoint,
  type JourneyCheckpointId,
  type JourneyProgress
} from "./journeyProgress";
import type { WorldZoneId } from "@wedding-game/shared";
import { findWorldZonePath } from "./journeyRouteSummary";
import { walkStepIntervalMs } from "./walkTiming";

export function remainingJourneyWaypoints(progress: JourneyProgress): JourneyCheckpoint[] {
  const completed = new Set(progress.completedIds);
  return journeyCheckpoints.filter((checkpoint) => !completed.has(checkpoint.id));
}

export function normalizeJourneyWaypointPlan(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[]
): JourneyCheckpointId[] {
  const remaining = remainingJourneyWaypoints(progress);
  const remainingIds = new Set(remaining.map(({ id }) => id));
  const normalized = checkpointIds.filter((id, index) => (
    remainingIds.has(id) && checkpointIds.indexOf(id) === index
  ));
  return normalized.length > 0 ? normalized : remaining.map(({ id }) => id);
}

export function toggleJourneyWaypoint(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[],
  checkpointId: JourneyCheckpointId
): JourneyCheckpointId[] {
  const normalized = normalizeJourneyWaypointPlan(progress, checkpointIds);
  if (normalized.includes(checkpointId)) {
    return normalized.length === 1 ? normalized : normalized.filter((id) => id !== checkpointId);
  }
  return [...normalized, checkpointId];
}

export function moveJourneyWaypoint(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[],
  checkpointId: JourneyCheckpointId,
  direction: "up" | "down"
): JourneyCheckpointId[] {
  const normalized = normalizeJourneyWaypointPlan(progress, checkpointIds);
  const currentIndex = normalized.indexOf(checkpointId);
  if (currentIndex < 0) return normalized;
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= normalized.length) return normalized;
  const result = [...normalized];
  [result[currentIndex], result[nextIndex]] = [result[nextIndex], result[currentIndex]];
  return result;
}

function routeTransitionCost(activeZoneId: WorldZoneId, checkpointIds: readonly JourneyCheckpointId[]): number {
  let cursor = activeZoneId;
  let cost = 0;
  for (const checkpointId of checkpointIds) {
    const checkpoint = journeyCheckpoints.find((candidate) => candidate.id === checkpointId);
    if (!checkpoint) continue;
    cost += Math.max(0, findWorldZonePath(cursor, checkpoint.zoneId).length - 1);
    cursor = checkpoint.zoneId;
  }
  return cost;
}

export function optimizeJourneyWaypointPlan(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[],
  activeZoneId: WorldZoneId
): JourneyCheckpointId[] {
  const normalized = normalizeJourneyWaypointPlan(progress, checkpointIds);
  if (normalized.length < 2) return normalized;

  let best = normalized;
  let bestCost = routeTransitionCost(activeZoneId, normalized);
  const visit = (prefix: JourneyCheckpointId[], remaining: JourneyCheckpointId[]) => {
    if (remaining.length === 0) {
      const cost = routeTransitionCost(activeZoneId, prefix);
      if (cost < bestCost) {
        best = prefix;
        bestCost = cost;
      }
      return;
    }
    for (let index = 0; index < remaining.length; index += 1) {
      visit(
        [...prefix, remaining[index]],
        remaining.filter((_, candidateIndex) => candidateIndex !== index)
      );
    }
  };
  visit([], normalized);
  return best;
}

export type JourneyWaypointEstimate = {
  waypointCount: number;
  zoneTransitions: number;
  estimatedSeconds: number;
  label: string;
};

export function estimateJourneyWaypointPlan(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[],
  activeZoneId: WorldZoneId,
  firstLegTiles = 0
): JourneyWaypointEstimate {
  const normalized = normalizeJourneyWaypointPlan(progress, checkpointIds);
  const checkpoints = normalized.flatMap((id) => {
    const checkpoint = journeyCheckpoints.find((candidate) => candidate.id === id);
    return checkpoint ? [checkpoint] : [];
  });
  let cursor = activeZoneId;
  let zoneTransitions = 0;
  for (const checkpoint of checkpoints) {
    zoneTransitions += Math.max(0, findWorldZonePath(cursor, checkpoint.zoneId).length - 1);
    cursor = checkpoint.zoneId;
  }
  const walkingSeconds = Math.ceil(Math.max(0, firstLegTiles) * walkStepIntervalMs / 1_000);
  const estimatedSeconds = Math.max(
    checkpoints.length > 0 ? 10 : 0,
    walkingSeconds + zoneTransitions * 12 + checkpoints.length * 8
  );
  const minutes = Math.max(1, Math.ceil(estimatedSeconds / 60));
  return {
    waypointCount: checkpoints.length,
    zoneTransitions,
    estimatedSeconds,
    label: estimatedSeconds < 60 ? `약 ${estimatedSeconds}초` : `약 ${minutes}분`
  };
}

export function firstJourneyWaypoint(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[]
): JourneyCheckpoint | null {
  const [firstId] = normalizeJourneyWaypointPlan(progress, checkpointIds);
  return journeyCheckpoints.find((checkpoint) => checkpoint.id === firstId) ?? null;
}
