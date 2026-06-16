import type { Direction } from "@wedding-game/shared";
import { clampToWorld, isBlocked } from "./geometry";
import type { GardenWorld, Point, Rect } from "./world";

export type MoveInput = {
  current: Point;
  target: Point;
  deltaMs: number;
  speed: number;
  world: GardenWorld;
};

export type GridMoveInput = {
  current: Point;
  direction: Direction;
  world: GardenWorld;
  tileSize?: number;
};

export const gridTileSize = 30;

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function safeCurrentPosition(input: MoveInput): Point {
  if (isFinitePoint(input.current)) {
    return clampToWorld(input.current, input.world.bounds);
  }

  if (isFinitePoint(input.world.spawn)) {
    return clampToWorld(input.world.spawn, input.world.bounds);
  }

  return { x: input.world.bounds.x, y: input.world.bounds.y };
}

function nearestTileCenter(value: number, min: number, max: number, tileSize: number): number {
  const firstCenter = min + tileSize / 2;
  const lastCenter = max - tileSize / 2;
  const tileIndex = Math.round((value - firstCenter) / tileSize);

  return Math.min(lastCenter, Math.max(firstCenter, firstCenter + tileIndex * tileSize));
}

export function snapToGrid(point: Point, world: GardenWorld, tileSize = gridTileSize): Point {
  const fallback = isFinitePoint(point) ? point : world.spawn;
  const bounds = world.bounds;

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

function segmentIntersectsRect(from: Point, to: Point, rect: Rect): boolean {
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
        return false;
      }
      continue;
    }

    const first = (axis.min - axis.start) / axis.delta;
    const second = (axis.max - axis.start) / axis.delta;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));

    if (enter > exit) {
      return false;
    }
  }

  return true;
}

function crossesBlockedRect(from: Point, to: Point, world: GardenWorld): boolean {
  return world.blocked.some((rect) => segmentIntersectsRect(from, to, rect));
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
    const target = clampToWorld(input.target, input.world.bounds);
    return crossesBlockedRect(current, target, input.world) ? current : target;
  }

  const next = clampToWorld({
    x: current.x + (dx / distance) * maxStep,
    y: current.y + (dy / distance) * maxStep
  }, input.world.bounds);

  return crossesBlockedRect(current, next, input.world) ? current : next;
}

export function directionFromVector(vector: Point): Direction {
  if (Math.abs(vector.x) > Math.abs(vector.y)) {
    return vector.x >= 0 ? "right" : "left";
  }
  return vector.y >= 0 ? "down" : "up";
}
