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

export function computeNextPosition(input: MoveInput): Point {
  const dx = input.target.x - input.current.x;
  const dy = input.target.y - input.current.y;
  const distance = Math.hypot(dx, dy);
  const maxStep = (input.speed * input.deltaMs) / 1000;

  if (distance <= maxStep) {
    return isBlocked(input.target, input.world)
      ? input.current
      : clampToWorld(input.target, input.world.bounds);
  }

  const next = clampToWorld({
    x: input.current.x + (dx / distance) * maxStep,
    y: input.current.y + (dy / distance) * maxStep
  }, input.world.bounds);

  return isBlocked(next, input.world) ? input.current : next;
}

export function directionFromVector(vector: Point): Direction {
  if (Math.abs(vector.x) > Math.abs(vector.y)) {
    return vector.x >= 0 ? "right" : "left";
  }
  return vector.y >= 0 ? "down" : "up";
}
