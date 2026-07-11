import type { Direction } from "@wedding-game/shared";

export const tileInputInitialDelayMs = 300;
export const tileInputRepeatIntervalMs = 240;

export type TileInputState = {
  direction: Direction;
  nextStepAt: number;
  hasStepped: boolean;
};

export type TileInputResult = {
  shouldStep: boolean;
  state: TileInputState;
};

export function createTileInputState(direction: Direction, now: number): TileInputState {
  return {
    direction,
    nextStepAt: now,
    hasStepped: false
  };
}

export function advanceTileInput(
  state: TileInputState,
  direction: Direction,
  now: number
): TileInputResult {
  const current = direction === state.direction ? state : createTileInputState(direction, now);

  if (now < current.nextStepAt) {
    return { shouldStep: false, state: current };
  }

  return {
    shouldStep: true,
    state: {
      direction,
      hasStepped: true,
      nextStepAt: now + (current.hasStepped ? tileInputRepeatIntervalMs : tileInputInitialDelayMs)
    }
  };
}
