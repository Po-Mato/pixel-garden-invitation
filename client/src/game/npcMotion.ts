import type { Direction, WorldZoneId } from "@wedding-game/shared";
import { isBlocked } from "./geometry";
import { gridTileSize } from "./movement";
import type { Point, WorldNpc, WorldZone } from "./world";

export type NpcReaction = "idle" | "greet" | "yield";

export type NpcMotionState = {
  point: Point;
  direction: Direction;
  moving: boolean;
  stepFrame: number;
  waypointIndex: number;
  reaction: NpcReaction;
};

export type NpcMotionMap = Record<string, NpcMotionState>;

function motionKey(zoneId: WorldZoneId, npcId: WorldNpc["id"]): string {
  return `${zoneId}:${npcId}`;
}

function directionToward(from: Point, to: Point): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

function patrolPoints(zone: WorldZone, npc: WorldNpc): Point[] {
  if (zone.id === "bridal-room") {
    return [
      { x: npc.x, y: npc.y },
      { x: npc.x + gridTileSize, y: npc.y },
      { x: npc.x, y: npc.y },
      { x: npc.x - gridTileSize, y: npc.y }
    ];
  }
  if (zone.id === "ceremony-hall") {
    return [
      { x: npc.x, y: npc.y },
      { x: npc.x, y: npc.y + gridTileSize },
      { x: npc.x, y: npc.y }
    ];
  }
  return [{ x: npc.x, y: npc.y }];
}

function validNpcPoint(zone: WorldZone, point: Point): boolean {
  const safe = zone.cameraSafeBounds;
  return point.x >= safe.x
    && point.x <= safe.x + safe.width
    && point.y >= safe.y
    && point.y <= safe.y + safe.height
    && !isBlocked(point, zone);
}

function stepToward(from: Point, to: Point): Point {
  const direction = directionToward(from, to);
  if (direction === "left") return { x: from.x - gridTileSize, y: from.y };
  if (direction === "right") return { x: from.x + gridTileSize, y: from.y };
  if (direction === "up") return { x: from.x, y: from.y - gridTileSize };
  return { x: from.x, y: from.y + gridTileSize };
}

function yieldingPoint(zone: WorldZone, current: Point, player: Point, occupied: readonly Point[]): Point | null {
  const candidates = [
    { x: current.x - gridTileSize, y: current.y },
    { x: current.x + gridTileSize, y: current.y },
    { x: current.x, y: current.y - gridTileSize },
    { x: current.x, y: current.y + gridTileSize }
  ].filter((point) => validNpcPoint(zone, point))
    .filter((point) => occupied.every((other) => Math.hypot(point.x - other.x, point.y - other.y) >= gridTileSize * 1.35))
    .sort((left, right) => (
      Math.hypot(right.x - player.x, right.y - player.y)
      - Math.hypot(left.x - player.x, left.y - player.y)
    ));
  return candidates[0] ?? null;
}

export function createNpcMotionMap(zone: WorldZone): NpcMotionMap {
  return Object.fromEntries(zone.npcs.map((npc, index) => [
    motionKey(zone.id, npc.id),
    {
      point: { x: npc.x, y: npc.y },
      direction: "down" as const,
      moving: false,
      stepFrame: 1,
      waypointIndex: index % Math.max(1, patrolPoints(zone, npc).length),
      reaction: "idle" as const
    }
  ]));
}

export function npcMotionFor(zone: WorldZone, npc: WorldNpc, motions: NpcMotionMap): NpcMotionState {
  return motions[motionKey(zone.id, npc.id)] ?? {
    point: { x: npc.x, y: npc.y },
    direction: "down",
    moving: false,
    stepFrame: 1,
    waypointIndex: 0,
    reaction: "idle"
  };
}

export function advanceNpcMotionMap(
  zone: WorldZone,
  motions: NpcMotionMap,
  player: Point,
  pausedNpcIds: readonly WorldNpc["id"][] = []
): NpcMotionMap {
  const next: NpcMotionMap = {};
  const occupied: Point[] = [];
  const currentNpcPoints = zone.npcs.map((npc) => ({
    id: npc.id,
    point: npcMotionFor(zone, npc, motions).point
  }));

  for (const npc of zone.npcs) {
    const key = motionKey(zone.id, npc.id);
    const current = npcMotionFor(zone, npc, motions);
    const distance = Math.hypot(current.point.x - player.x, current.point.y - player.y);

    if (pausedNpcIds.includes(npc.id)) {
      next[key] = {
        ...current,
        direction: directionToward(current.point, player),
        moving: false,
        stepFrame: 1,
        reaction: "greet"
      };
      occupied.push(current.point);
      continue;
    }

    if (distance < gridTileSize * 1.8) {
      const yieldTo = yieldingPoint(zone, current.point, player, [
        ...occupied,
        ...currentNpcPoints.filter(({ id }) => id !== npc.id).map(({ point }) => point)
      ]);
      next[key] = yieldTo ? {
        ...current,
        point: yieldTo,
        direction: directionToward(current.point, yieldTo),
        moving: true,
        stepFrame: current.stepFrame === 0 ? 2 : 0,
        reaction: "yield"
      } : {
        ...current,
        direction: directionToward(current.point, player),
        moving: false,
        stepFrame: 1,
        reaction: "yield"
      };
      occupied.push(next[key].point);
      continue;
    }

    if (distance < gridTileSize * 3.6) {
      next[key] = {
        ...current,
        direction: directionToward(current.point, player),
        moving: false,
        stepFrame: 1,
        reaction: "greet"
      };
      occupied.push(current.point);
      continue;
    }

    const waypoints = patrolPoints(zone, npc);
    const goalIndex = current.waypointIndex % waypoints.length;
    const goal = waypoints[goalIndex];
    const reachedGoal = current.point.x === goal.x && current.point.y === goal.y;
    const targetIndex = reachedGoal ? (goalIndex + 1) % waypoints.length : goalIndex;
    const target = waypoints[targetIndex];
    const candidate = stepToward(current.point, target);
    const canStep = waypoints.length > 1 && validNpcPoint(zone, candidate);

    next[key] = canStep ? {
      ...current,
      point: candidate,
      direction: directionToward(current.point, candidate),
      moving: true,
      stepFrame: current.stepFrame === 0 ? 2 : 0,
      waypointIndex: targetIndex,
      reaction: "idle"
    } : {
      ...current,
      moving: false,
      stepFrame: 1,
      waypointIndex: targetIndex,
      reaction: "idle"
    };
    occupied.push(next[key].point);
  }

  return next;
}
