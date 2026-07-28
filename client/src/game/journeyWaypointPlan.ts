import {
  journeyCheckpoints,
  type JourneyCheckpoint,
  type JourneyCheckpointId,
  type JourneyProgress
} from "./journeyProgress";
import type { WorldZoneId } from "@wedding-game/shared";
import { findWorldZonePath } from "./journeyRouteSummary";
import { resolveJourneyCheckpointRoute } from "./journeyGuidance";
import { findNearestPortalRoute } from "./pathfinding";
import { walkStepIntervalMs } from "./walkTiming";
import { gardenWorld, getWorldZone, type GardenWorld, type Point } from "./world";

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

export type JourneyRouteCursor = { zoneId: WorldZoneId; position: Point };

export type JourneyRouteMetrics = {
  tileSteps: number;
  portalTransitions: number;
  available: boolean;
  end: JourneyRouteCursor;
};

const portalTransitionEstimateMs = 700;
const checkpointInteractionEstimateMs = 900;

function checkpointById(id: JourneyCheckpointId): JourneyCheckpoint | null {
  return journeyCheckpoints.find((candidate) => candidate.id === id) ?? null;
}

export function estimateJourneyCheckpointRoute(
  start: JourneyRouteCursor,
  checkpoint: JourneyCheckpoint,
  world: GardenWorld = gardenWorld
): JourneyRouteMetrics {
  let cursor = start;
  let tileSteps = 0;
  let portalTransitions = 0;
  const zonePath = findWorldZonePath(cursor.zoneId, checkpoint.zoneId, world);

  if (cursor.zoneId !== checkpoint.zoneId && zonePath.at(-1) !== checkpoint.zoneId) {
    return { tileSteps, portalTransitions, available: false, end: cursor };
  }

  for (const nextZoneId of zonePath.slice(1)) {
    const zone = getWorldZone(world, cursor.zoneId);
    const portal = zone.portals.find((candidate) => candidate.to === nextZoneId);
    if (!portal) return { tileSteps, portalTransitions, available: false, end: cursor };
    const route = findNearestPortalRoute(zone, cursor.position, portal);
    if (!route) return { tileSteps, portalTransitions, available: false, end: cursor };
    tileSteps += route.path.length;
    portalTransitions += 1;
    cursor = { zoneId: nextZoneId, position: portal.spawn };
  }

  const destinationZone = getWorldZone(world, checkpoint.zoneId);
  const destinationRoute = resolveJourneyCheckpointRoute(destinationZone, cursor.position, checkpoint);
  if (!destinationRoute) return { tileSteps, portalTransitions, available: false, end: cursor };

  tileSteps += destinationRoute.path.length;
  return {
    tileSteps,
    portalTransitions,
    available: true,
    end: { zoneId: checkpoint.zoneId, position: destinationRoute.entry }
  };
}

function estimateCheckpointSequence(
  start: JourneyRouteCursor,
  checkpointIds: readonly JourneyCheckpointId[],
  world: GardenWorld,
  cache?: Map<string, JourneyRouteMetrics>
): JourneyRouteMetrics {
  let cursor = start;
  let tileSteps = 0;
  let portalTransitions = 0;

  for (const checkpointId of checkpointIds) {
    const checkpoint = checkpointById(checkpointId);
    if (!checkpoint) continue;
    const cacheKey = `${cursor.zoneId}:${cursor.position.x}:${cursor.position.y}:${checkpoint.id}`;
    let leg = cache?.get(cacheKey);
    if (!leg) {
      leg = estimateJourneyCheckpointRoute(cursor, checkpoint, world);
      cache?.set(cacheKey, leg);
    }
    tileSteps += leg.tileSteps;
    portalTransitions += leg.portalTransitions;
    cursor = leg.end;
    if (!leg.available) {
      return { tileSteps, portalTransitions, available: false, end: cursor };
    }
  }

  return { tileSteps, portalTransitions, available: true, end: cursor };
}

export function optimizeJourneyWaypointPlan(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[],
  activeZoneId: WorldZoneId,
  position: Point = getWorldZone(gardenWorld, activeZoneId).spawn,
  world: GardenWorld = gardenWorld
): JourneyCheckpointId[] {
  const normalized = normalizeJourneyWaypointPlan(progress, checkpointIds);
  if (normalized.length < 2) return normalized;

  let best = normalized;
  let bestCost = Number.POSITIVE_INFINITY;
  const start = { zoneId: activeZoneId, position };
  const routeCache = new Map<string, JourneyRouteMetrics>();
  const visit = (prefix: JourneyCheckpointId[], remaining: JourneyCheckpointId[]) => {
    if (remaining.length === 0) {
      const estimate = estimateCheckpointSequence(start, prefix, world, routeCache);
      const cost = estimate.available
        ? estimate.tileSteps * walkStepIntervalMs + estimate.portalTransitions * portalTransitionEstimateMs
        : Number.POSITIVE_INFINITY;
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
  tileSteps: number;
  available: boolean;
  estimatedSeconds: number;
  label: string;
};

export function estimateJourneyWaypointPlan(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[],
  activeZoneId: WorldZoneId,
  position: Point = getWorldZone(gardenWorld, activeZoneId).spawn,
  world: GardenWorld = gardenWorld
): JourneyWaypointEstimate {
  const normalized = normalizeJourneyWaypointPlan(progress, checkpointIds);
  const checkpoints = normalized.flatMap((id) => checkpointById(id) ? [id] : []);
  const route = estimateCheckpointSequence({ zoneId: activeZoneId, position }, checkpoints, world);
  const estimatedSeconds = route.available
    ? Math.ceil((
      route.tileSteps * walkStepIntervalMs
      + route.portalTransitions * portalTransitionEstimateMs
      + checkpoints.length * checkpointInteractionEstimateMs
    ) / 1_000)
    : 0;
  const roundedSeconds = Math.ceil(estimatedSeconds / 5) * 5;
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return {
    waypointCount: checkpoints.length,
    zoneTransitions: route.portalTransitions,
    tileSteps: route.tileSteps,
    available: route.available,
    estimatedSeconds,
    label: route.available
      ? minutes > 0
        ? `약 ${minutes}분${seconds > 0 ? ` ${seconds}초` : ""}`
        : `약 ${roundedSeconds}초`
      : "경로 확인 필요"
  };
}

export function firstJourneyWaypoint(
  progress: JourneyProgress,
  checkpointIds: readonly JourneyCheckpointId[]
): JourneyCheckpoint | null {
  const [firstId] = normalizeJourneyWaypointPlan(progress, checkpointIds);
  return journeyCheckpoints.find((checkpoint) => checkpoint.id === firstId) ?? null;
}
