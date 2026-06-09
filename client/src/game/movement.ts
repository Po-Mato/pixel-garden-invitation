import type { Direction } from "@wedding-game/shared";
import { clampToWorld, isBlocked } from "./geometry";
import type { GardenWorld, Point } from "./world";

export type MoveInput = {
  current: Point;
  target: Point;
  deltaMs: number;
  speed: number;
  world: GardenWorld;
};

const COLLISION_STEP_PX = 8;

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

function crossesBlockedRect(from: Point, to: Point, world: GardenWorld): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / COLLISION_STEP_PX));

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    if (isBlocked({ x: from.x + dx * progress, y: from.y + dy * progress }, world)) {
      return true;
    }
  }

  return false;
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
