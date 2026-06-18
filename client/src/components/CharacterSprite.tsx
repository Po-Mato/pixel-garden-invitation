import { useState } from "react";
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
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const safeAppearance = parseCharacterAppearance(appearance) ?? defaultCharacterAppearance;
  const frame = getWalkFrameStyle(direction, moving ? stepFrame : 1);
  const useFrontIdle = !moving && direction === "down";
  const layers = resolveCharacterLayers(safeAppearance);
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
