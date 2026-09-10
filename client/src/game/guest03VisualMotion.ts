import { createWorldMotionStore, type WorldMotionSnapshot, type WorldMotionStore } from "./worldMotionStore";
import { neutralWalkFrame, walkStepIntervalMs, walkTileSizePx } from "./walkTiming";

// Presentation only: never writes to the collision/network motion store.
export function createGuest03VisualMotion(source: WorldMotionStore) {
  const store = createWorldMotionStore(source.getSnapshot());
  let logical = source.getSnapshot();
  let queue: WorldMotionSnapshot["position"][] = [];
  let distance = 0;
  let previousTime: number | null = null;
  function reset() {
    logical = source.getSnapshot();
    queue = [];
    distance = 0;
    previousTime = null;
    store.update({ ...logical, moving: false, stepFrame: neutralWalkFrame });
  }
  function receive() {
    const next = source.getSnapshot();
    const dx = next.position.x - logical.position.x;
    const dy = next.position.y - logical.position.y;
    logical = next;
    if (Math.abs(dx) + Math.abs(dy) > walkTileSizePx || (dx !== 0 && dy !== 0)) {
      reset(); // Teleports must not animate through walls or across zones.
    } else if (dx !== 0 || dy !== 0) {
      queue.push(next.position);
    } else if (queue.length === 0) {
      store.update({ direction: next.direction, moving: false, stepFrame: neutralWalkFrame });
    }
  }
  function tick(time: number) {
    // A suspended/background tab must not replay an accumulated path.
    if (previousTime !== null && time - previousTime > 250) reset();
    const elapsed = previousTime === null ? 0 : Math.max(0, time - previousTime);
    previousTime = time;
    let remaining = elapsed * walkTileSizePx / walkStepIntervalMs;
    while (queue.length && remaining > 0) {
      const from = store.getSnapshot().position;
      const target = queue[0];
      const dx = target.x - from.x;
      const dy = target.y - from.y;
      const length = Math.abs(dx) + Math.abs(dy);
      const travel = Math.min(length, remaining);
      distance += travel;
      remaining -= travel;
      store.update({
        position: length === travel ? target : { x: from.x + dx * travel / length, y: from.y + dy * travel / length },
        direction: dx !== 0 ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"),
        moving: true,
        stepFrame: Math.floor(distance / walkTileSizePx) % 4
      });
      if (travel === length) queue.shift();
    }
    if (!queue.length && !logical.moving) {
      store.update({ moving: false, stepFrame: neutralWalkFrame, direction: logical.direction });
      distance = 0;
    }
  }
  return { store, receive, tick, reset };
}
