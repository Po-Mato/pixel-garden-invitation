import type { Direction } from "@wedding-game/shared";

export type SpriteFrameSize = {
  width: number;
  height: number;
};

const directionRow: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3
};

const defaultFrameSize: SpriteFrameSize = { width: 48, height: 72 };

export function getWalkFrameStyle(
  direction: Direction,
  stepFrame: number,
  frameSize: SpriteFrameSize = defaultFrameSize
) {
  const frame = ((stepFrame % 3) + 3) % 3;
  const row = directionRow[direction];
  return {
    x: frame === 0 ? 0 : frame * -frameSize.width,
    y: row === 0 ? 0 : row * -frameSize.height
  };
}
