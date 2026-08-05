import type { Direction } from "@wedding-game/shared";
import type { Point } from "./world";

export type WorldMotionSnapshot = {
  position: Point;
  direction: Direction;
  moving: boolean;
  stepFrame: number;
};

export type WorldMotionStore = {
  getSnapshot: () => WorldMotionSnapshot;
  subscribe: (listener: () => void) => () => void;
  update: (patch: Partial<WorldMotionSnapshot>) => void;
};

function sameSnapshot(left: WorldMotionSnapshot, right: WorldMotionSnapshot): boolean {
  return left.position.x === right.position.x
    && left.position.y === right.position.y
    && left.direction === right.direction
    && left.moving === right.moving
    && left.stepFrame === right.stepFrame;
}

export function createWorldMotionStore(initial: WorldMotionSnapshot): WorldMotionStore {
  let snapshot = initial;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(patch) {
      const next = {
        ...snapshot,
        ...patch,
        position: patch.position ?? snapshot.position
      };
      if (sameSnapshot(snapshot, next)) return;
      snapshot = next;
      listeners.forEach((listener) => listener());
    }
  };
}
