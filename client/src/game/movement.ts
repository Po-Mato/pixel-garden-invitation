import type { Direction } from "@wedding-game/shared";
import { clampToWorld, isBlocked } from "./geometry";
import type { Point, Rect, WorldZone } from "./world";

export type MoveInput = {
  current: Point;
  target: Point;
  deltaMs: number;
  speed: number;
  world: WorldZone;
};

export type GridMoveInput = {
  current: Point;
  direction: Direction;
  world: WorldZone;
  tileSize?: number;
};

export const gridTileSize = 30;

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function safeCurrentPosition(input: MoveInput): Point {
  if (isFinitePoint(input.current)) {
    return clampToWorld(input.current, input.world.cameraSafeBounds);
  }

  if (isFinitePoint(input.world.spawn)) {
    return clampToWorld(input.world.spawn, input.world.cameraSafeBounds);
  }

  return { x: input.world.cameraSafeBounds.x, y: input.world.cameraSafeBounds.y };
}

function nearestTileCenter(value: number, min: number, max: number, tileSize: number): number {
  const firstCenter = min + tileSize / 2;
  const lastCenter = max - tileSize / 2;
  const tileIndex = Math.round((value - firstCenter) / tileSize);

  return Math.min(lastCenter, Math.max(firstCenter, firstCenter + tileIndex * tileSize));
}

export function snapToGrid(point: Point, world: WorldZone, tileSize = gridTileSize): Point {
  const fallback = isFinitePoint(point) ? point : world.spawn;
  const bounds = world.cameraSafeBounds;

  return {
    x: nearestTileCenter(fallback.x, bounds.x, bounds.x + bounds.width, tileSize),
    y: nearestTileCenter(fallback.y, bounds.y, bounds.y + bounds.height, tileSize)
  };
}

function directionOffset(direction: Direction, tileSize: number): Point {
  if (direction === "up") {
    return { x: 0, y: -tileSize };
  }

  if (direction === "down") {
    return { x: 0, y: tileSize };
  }

  if (direction === "left") {
    return { x: -tileSize, y: 0 };
  }

  return { x: tileSize, y: 0 };
}

export function computeNextGridPosition(input: GridMoveInput): Point {
  const tileSize = input.tileSize ?? gridTileSize;
  const current = snapToGrid(input.current, input.world, tileSize);
  const offset = directionOffset(input.direction, tileSize);
  const next = snapToGrid({ x: current.x + offset.x, y: current.y + offset.y }, input.world, tileSize);

  if (isBlocked(next, input.world)) {
    return current;
  }

  return next;
}

export function directionTowardPoint(current: Point, target: Point): Direction | null {
  const dx = target.x - current.x;
  const dy = target.y - current.y;

  if (dx === 0 && dy === 0) {
    return null;
  }

  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
    return dx > 0 ? "right" : "left";
  }

  return dy > 0 ? "down" : "up";
}

type SegmentInterval = { start: number; end: number };

function segmentRectInterval(from: Point, to: Point, rect: Rect): SegmentInterval | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let enter = 0;
  let exit = 1;

  const axes = [
    { start: from.x, delta: dx, min: rect.x, max: rect.x + rect.width },
    { start: from.y, delta: dy, min: rect.y, max: rect.y + rect.height }
  ];

  for (const axis of axes) {
    if (axis.delta === 0) {
      if (axis.start < axis.min || axis.start > axis.max) {
        return null;
      }
      continue;
    }

    const first = (axis.min - axis.start) / axis.delta;
    const second = (axis.max - axis.start) / axis.delta;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));

    if (enter > exit) {
      return null;
    }
  }

  return { start: enter, end: exit };
}

function segmentIntersectsRect(from: Point, to: Point, rect: Rect): boolean {
  return segmentRectInterval(from, to, rect) !== null;
}

function crossesBlockedRect(from: Point, to: Point, world: WorldZone): boolean {
  return world.blocked.some((rect) => segmentIntersectsRect(from, to, rect));
}

function staysOnWalkablePaths(from: Point, to: Point, world: WorldZone): boolean {
  const intervals = world.paths
    .map((path) => segmentRectInterval(from, to, path))
    .filter((interval): interval is SegmentInterval => interval !== null)
    .sort((first, second) => first.start - second.start);
  let coveredThrough = 0;

  for (const interval of intervals) {
    if (interval.start > coveredThrough) {
      return false;
    }
    coveredThrough = Math.max(coveredThrough, interval.end);
    if (coveredThrough >= 1) {
      return true;
    }
  }

  return false;
}

function canMoveContinuously(from: Point, to: Point, world: WorldZone): boolean {
  return !isBlocked(to, world) && !crossesBlockedRect(from, to, world) && staysOnWalkablePaths(from, to, world);
}

export function computeNextPosition(input: MoveInput): Point {
  const current = safeCurrentPosition(input);

  if (
    !isFinitePoint(input.current) ||
    !isFinitePoint(input.target) ||
    !Number.isFinite(input.deltaMs) ||
    !Number.isFinite(input.speed) ||
    input.deltaMs < 0 ||
    input.speed < 0
  ) {
    return current;
  }

  const dx = input.target.x - current.x;
  const dy = input.target.y - current.y;
  const distance = Math.hypot(dx, dy);
  const maxStep = (input.speed * input.deltaMs) / 1000;

  if (distance <= maxStep) {
    const target = clampToWorld(input.target, input.world.cameraSafeBounds);
    return canMoveContinuously(current, target, input.world) ? target : current;
  }

  const next = clampToWorld({
    x: current.x + (dx / distance) * maxStep,
    y: current.y + (dy / distance) * maxStep
  }, input.world.cameraSafeBounds);

  return canMoveContinuously(current, next, input.world) ? next : current;
}

export function directionFromVector(vector: Point): Direction {
  if (Math.abs(vector.x) > Math.abs(vector.y)) {
    return vector.x >= 0 ? "right" : "left";
  }
  return vector.y >= 0 ? "down" : "up";
}
