import { useState, type CSSProperties } from "react";
import {
  defaultCharacterAppearance,
  parseCharacterAppearance,
  type CharacterAppearance,
  type Direction
} from "@wedding-game/shared";
import { resolveCharacterLayers, type CharacterDisplayMode } from "../character/assets";
import { getWalkFrameStyle } from "../character/frame";
import { resolveCharacterMotionProfile } from "../character/motionProfile";
import { trackInvitationAnalytics } from "../analytics/invitationAnalytics";

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
  const motionProfile = resolveCharacterMotionProfile(safeAppearance);
  const useFrontIdle = !moving && direction === "down";
  const layers = resolveCharacterLayers(safeAppearance, import.meta.env.BASE_URL, displayMode);
  const sourceSize = layers[0].sourceSize;
  const displaySize = layers[0].displaySize[displayMode];
  const renderedStepFrame = moving ? ((stepFrame % 4) + 4) % 4 : 1;
  const frame = getWalkFrameStyle(direction, renderedStepFrame, sourceSize);
  const renderedLayers = layers.flatMap((layer) => {
    const preferredUrl = useFrontIdle && layer.idleUrl ? layer.idleUrl : layer.walkUrl;
    const fallbackUrl = useFrontIdle && layer.fallbackIdleUrl
      ? layer.fallbackIdleUrl
      : layer.fallbackWalkUrl;
    const preferredFailed = failedUrls.has(preferredUrl);
    const url = preferredFailed ? fallbackUrl : preferredUrl;
    return failedUrls.has(url) ? [] : [{
      layer,
      url,
      fallback: preferredFailed,
      fallbackAvailable: preferredUrl !== fallbackUrl
    }];
  });
  const spriteStyle = {
    "--character-source-width": `${sourceSize.width}px`,
    "--character-source-height": `${sourceSize.height}px`,
    "--character-display-width": `${displaySize.width}px`,
    "--character-display-height": `${displaySize.height}px`,
    "--character-display-scale-x": String(displaySize.width / sourceSize.width),
    "--character-display-scale-y": String(displaySize.height / sourceSize.height)
  } as CSSProperties;
  const markFailed = (url: string, fallbackActivated: boolean) => {
    if (import.meta.env.DEV) {
      console.error(`Character asset failed: ${url}`);
    }
    if (fallbackActivated && !failedUrls.has(url)) {
      trackInvitationAnalytics("character_asset_fallback", safeAppearance.presetId);
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
      className={`character-sprite character-sprite--${displayMode} ${useFrontIdle ? "character-sprite--idle-front" : ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      data-direction={direction}
      data-moving={moving ? "true" : "false"}
      data-walk-frame={renderedStepFrame}
      data-character-preset={safeAppearance.presetId}
      data-motion-profile={motionProfile}
      data-character-fallback={renderedLayers.some(({ fallback }) => fallback) || undefined}
      style={spriteStyle}
    >
      {renderedLayers.map(({ layer, url, fallback, fallbackAvailable }) => {
        const layerImageUrl = typeof document === "undefined"
          ? url
          : new URL(url, document.baseURI).href;
        return (
          <span
            key={`${layer.slot}:${layer.walkUrl}`}
            data-character-layer={layer.slot}
            data-character-fallback={fallback || undefined}
            className={`character-layer character-layer--${layer.slot}`}
            style={{
              backgroundImage: `url("${layerImageUrl}")`,
              backgroundPosition: useFrontIdle && layer.idleUrl ? "0 0" : `${frame.x}px ${frame.y}px`,
              "--character-layer-image": `url("${layerImageUrl}")`,
              "--character-frame-position": useFrontIdle && layer.idleUrl ? "0 0" : `${frame.x}px ${frame.y}px`
            } as CSSProperties}
          >
            <img
              className="character-layer__preload"
              src={url}
              alt=""
              aria-hidden="true"
              onError={() => markFailed(url, !fallback && fallbackAvailable)}
            />
          </span>
        );
      })}
    </span>
  );
}
