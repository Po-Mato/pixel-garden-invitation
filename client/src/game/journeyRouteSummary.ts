import type { WorldZoneId } from "@wedding-game/shared";
import type { JourneyCheckpoint, JourneyProgress } from "./journeyProgress";
import { journeyCheckpoints } from "./journeyProgress";
import { gardenWorld, getWorldZone, type GardenWorld } from "./world";

export type JourneyRouteSummary = {
  remainingCheckpoints: number;
  zoneTransitions: number;
  estimatedStages: number;
  nextZonePath: WorldZoneId[];
};

export function findWorldZonePath(
  from: WorldZoneId,
  target: WorldZoneId,
  world: GardenWorld = gardenWorld
): WorldZoneId[] {
  if (from === target) return [from];
  const visited = new Set<WorldZoneId>([from]);
  const queue: WorldZoneId[][] = [[from]];

  while (queue.length) {
    const path = queue.shift()!;
    const zoneId = path[path.length - 1];
    for (const portal of getWorldZone(world, zoneId).portals) {
      if (visited.has(portal.to)) continue;
      const nextPath = [...path, portal.to];
      if (portal.to === target) return nextPath;
      visited.add(portal.to);
      queue.push(nextPath);
    }
  }

  return [from];
}

export function summarizeRemainingJourney(
  progress: JourneyProgress,
  activeZoneId: WorldZoneId,
  world: GardenWorld = gardenWorld
): JourneyRouteSummary {
  const completed = new Set(progress.completedIds);
  const remaining = journeyCheckpoints.filter((checkpoint) => !completed.has(checkpoint.id));
  let cursor = activeZoneId;
  let zoneTransitions = 0;

  remaining.forEach((checkpoint) => {
    const path = findWorldZonePath(cursor, checkpoint.zoneId, world);
    zoneTransitions += Math.max(0, path.length - 1);
    cursor = checkpoint.zoneId;
  });

  return {
    remainingCheckpoints: remaining.length,
    zoneTransitions,
    estimatedStages: zoneTransitions + remaining.length,
    nextZonePath: remaining[0] ? findWorldZonePath(activeZoneId, remaining[0].zoneId, world) : [activeZoneId]
  };
}

export function journeyDestinationInstruction(checkpoint: JourneyCheckpoint, world: GardenWorld = gardenWorld): string {
  const zone = getWorldZone(world, checkpoint.zoneId);
  if (checkpoint.target.type === "spot") {
    const spotId = checkpoint.target.spotId;
    const spot = zone.spots.find((candidate) => candidate.id === spotId);
    return `${spot?.label ?? checkpoint.label} 가까이에서 상호작용하세요.`;
  }
  if (checkpoint.target.type === "npc") return "신부 캐릭터 가까이에서 대화를 시작하세요.";
  return `${zone.label}에 도착하면 방문이 기록됩니다.`;
}
