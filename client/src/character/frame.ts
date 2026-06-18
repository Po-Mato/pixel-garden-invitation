import type { Direction } from "@wedding-game/shared";

const directionRow: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3
};

export function getWalkFrameStyle(direction: Direction, stepFrame: number) {
  const frame = ((stepFrame % 3) + 3) % 3;
  const row = directionRow[direction];
  return { x: frame === 0 ? 0 : frame * -48, y: row === 0 ? 0 : row * -72 };
}
