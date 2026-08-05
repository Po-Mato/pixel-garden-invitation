import { describe, expect, it, vi } from "vitest";
import { createWorldMotionStore } from "./worldMotionStore";

describe("world motion store", () => {
  it("notifies the isolated motion subscribers without changing the snapshot identity for no-op updates", () => {
    const store = createWorldMotionStore({
      position: { x: 10, y: 20 },
      direction: "down",
      moving: false,
      stepFrame: 1
    });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const initial = store.getSnapshot();

    store.update({ position: { x: 10, y: 20 } });
    expect(store.getSnapshot()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();

    store.update({ position: { x: 26, y: 20 }, direction: "right", moving: true, stepFrame: 2 });
    expect(store.getSnapshot()).toEqual({
      position: { x: 26, y: 20 },
      direction: "right",
      moving: true,
      stepFrame: 2
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.update({ moving: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
