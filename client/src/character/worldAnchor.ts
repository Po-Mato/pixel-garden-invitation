import {
  guestPresetFrame,
  resolveGuestPreset,
  type CharacterAppearance
} from "@wedding-game/shared";
import type { CSSProperties } from "react";
import generatedWorldAnchors from "./worldAnchors.generated.json";

type SourceVisualAnchor = {
  centerX: number;
  centerY: number;
  feetY: number;
};

const fallbackSourceVisualAnchor: SourceVisualAnchor = {
  centerX: 48,
  centerY: 69.5,
  feetY: 133
};

function sourceVisualAnchor(presetId: string): SourceVisualAnchor {
  const generated = generatedWorldAnchors.presets[
    presetId as keyof typeof generatedWorldAnchors.presets
  ];
  return generated ?? fallbackSourceVisualAnchor;
}

function safeDevicePixelRatio(devicePixelRatio: number) {
  return Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
}

export function snapToDevicePixel(value: number, devicePixelRatio = 1) {
  const ratio = safeDevicePixelRatio(devicePixelRatio);
  return Math.round(value * ratio) / ratio;
}

export function resolveWorldCharacterAnchor(
  appearance: CharacterAppearance,
  devicePixelRatio = 1
) {
  const preset = resolveGuestPreset(appearance);
  const anchor = sourceVisualAnchor(preset.id);
  const scaleX = guestPresetFrame.display.world.width / guestPresetFrame.source.width;
  const scaleY = guestPresetFrame.display.world.height / guestPresetFrame.source.height;
  const displayCenterX = anchor.centerX * scaleX;
  const displayCenterY = anchor.centerY * scaleY;

  return {
    presetId: preset.id,
    centerOffsetX: snapToDevicePixel(
      displayCenterX - guestPresetFrame.display.world.width / 2,
      devicePixelRatio
    ),
    centerY: snapToDevicePixel(displayCenterY, devicePixelRatio),
    feetY: snapToDevicePixel(anchor.feetY * scaleY, devicePixelRatio)
  };
}

export function worldCharacterAnchorStyle(
  appearance: CharacterAppearance,
  devicePixelRatio = 1
) {
  const anchor = resolveWorldCharacterAnchor(appearance, devicePixelRatio);
  return {
    "--character-world-anchor-offset-x": `${anchor.centerOffsetX}px`,
    "--character-world-anchor-y": `${anchor.centerY}px`
  } as CSSProperties;
}
