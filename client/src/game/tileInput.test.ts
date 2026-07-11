import { describe, expect, it } from "vitest";
import {
  advanceTileInput,
  createTileInputState,
  tileInputInitialDelayMs,
  tileInputRepeatIntervalMs
} from "./tileInput";

describe("tile input repeat timing", () => {
  it("steps immediately, waits for the hold delay, then repeats at the slower interval", () => {
    let state = createTileInputState("right", 1_000);

    let result = advanceTileInput(state, "right", 1_000);
    expect(result.shouldStep).toBe(true);
    state = result.state;

    result = advanceTileInput(state, "right", 1_000 + tileInputInitialDelayMs - 1);
    expect(result.shouldStep).toBe(false);

    result = advanceTileInput(state, "right", 1_000 + tileInputInitialDelayMs);
    expect(result.shouldStep).toBe(true);
    state = result.state;

    result = advanceTileInput(
      state,
      "right",
      1_000 + tileInputInitialDelayMs + tileInputRepeatIntervalMs - 1
    );
    expect(result.shouldStep).toBe(false);

    result = advanceTileInput(
      result.state,
      "right",
      1_000 + tileInputInitialDelayMs + tileInputRepeatIntervalMs
    );
    expect(result.shouldStep).toBe(true);
  });

  it("steps immediately and restarts the hold delay when direction changes", () => {
    let state = createTileInputState("right", 0);
    state = advanceTileInput(state, "right", 0).state;

    const changed = advanceTileInput(state, "up", 80);
    expect(changed.shouldStep).toBe(true);

    const beforeDelay = advanceTileInput(changed.state, "up", 80 + tileInputInitialDelayMs - 1);
    expect(beforeDelay.shouldStep).toBe(false);
  });

  it("uses the approved mobile movement timings", () => {
    expect(tileInputInitialDelayMs).toBe(300);
    expect(tileInputRepeatIntervalMs).toBe(240);
  });
});
