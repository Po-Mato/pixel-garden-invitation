import {
  defaultCharacterAppearance,
  parseCharacterAppearance,
  type CharacterAppearance,
  type Direction
} from "@wedding-game/shared";
import { resolveCharacterLayers } from "../character/assets";
import { getWalkFrameStyle } from "../character/frame";

type Props = {
  appearance: CharacterAppearance;
  direction: Direction;
  moving: boolean;
  stepFrame?: number;
  label?: string;
};

export function CharacterSprite({ appearance, direction, moving, stepFrame = 1, label }: Props) {
  const safeAppearance = parseCharacterAppearance(appearance) ?? defaultCharacterAppearance;
  const frame = getWalkFrameStyle(direction, moving ? stepFrame : 1);
  const useFrontIdle = !moving && direction === "down";
  const layers = resolveCharacterLayers(safeAppearance);

  return (
    <span
      className={`character-sprite ${useFrontIdle ? "character-sprite--idle-front" : ""}`}
      aria-label={label}
    >
      {layers.map((layer) => (
        <span
          key={`${layer.slot}:${layer.walkUrl}`}
          data-character-layer={layer.slot}
          className={`character-layer character-layer--${layer.slot}`}
          style={{
            backgroundImage: `url("${useFrontIdle && layer.idleUrl ? layer.idleUrl : layer.walkUrl}")`,
            backgroundPosition: useFrontIdle && layer.idleUrl ? "0 0" : `${frame.x}px ${frame.y}px`
          }}
        />
      ))}
    </span>
  );
}
