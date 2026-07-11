import { useState, type CSSProperties } from "react";
import {
  defaultCharacterAppearance,
  parseCharacterAppearance,
  type CharacterAppearance,
  type Direction
} from "@wedding-game/shared";
import { resolveCharacterLayers, type CharacterDisplayMode } from "../character/assets";
import { getWalkFrameStyle } from "../character/frame";

type Props = {
  appearance: CharacterAppearance;
  direction: Direction;
  moving: boolean;
  stepFrame?: number;
  label?: string;
  displayMode?: CharacterDisplayMode;
};

export function CharacterSprite({
  appearance,
  direction,
  moving,
  stepFrame = 1,
  label,
  displayMode = "world"
}: Props) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const safeAppearance = parseCharacterAppearance(appearance) ?? defaultCharacterAppearance;
  const useFrontIdle = !moving && direction === "down";
  const layers = resolveCharacterLayers(safeAppearance, import.meta.env.BASE_URL, displayMode);
  const sourceSize = layers[0].sourceSize;
  const displaySize = layers[0].displaySize[displayMode];
  const frame = getWalkFrameStyle(direction, moving ? stepFrame : 1, sourceSize);
  const spriteStyle = {
    "--character-source-width": `${sourceSize.width}px`,
    "--character-source-height": `${sourceSize.height}px`,
    "--character-display-width": `${displaySize.width}px`,
    "--character-display-height": `${displaySize.height}px`,
    "--character-display-scale-x": String(displaySize.width / sourceSize.width),
    "--character-display-scale-y": String(displaySize.height / sourceSize.height)
  } as CSSProperties;
  const markFailed = (url: string) => {
    if (import.meta.env.DEV) {
      console.error(`Character asset failed: ${url}`);
    }
    setFailedUrls((current) => {
      if (current.has(url)) return current;
      const next = new Set(current);
      next.add(url);
      return next;
    });
  };

  return (
    <span
      className={`character-sprite ${useFrontIdle ? "character-sprite--idle-front" : ""}`}
      aria-label={label}
      style={spriteStyle}
    >
      {layers.map((layer) => {
        const url = useFrontIdle && layer.idleUrl ? layer.idleUrl : layer.walkUrl;
        if (failedUrls.has(url)) return null;
        return (
          <span
            key={`${layer.slot}:${layer.walkUrl}`}
            data-character-layer={layer.slot}
            className={`character-layer character-layer--${layer.slot}`}
            style={{
              backgroundImage: `url("${url}")`,
              backgroundPosition: useFrontIdle && layer.idleUrl ? "0 0" : `${frame.x}px ${frame.y}px`
            }}
          >
            <img
              className="character-layer__preload"
              src={url}
              alt=""
              aria-hidden="true"
              onError={() => markFailed(url)}
            />
          </span>
        );
      })}
    </span>
  );
}
