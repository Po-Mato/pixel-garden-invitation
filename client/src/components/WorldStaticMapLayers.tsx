import { memo } from "react";
import type { WorldZoneId } from "@wedding-game/shared";
import type { WorldDecoration as WorldDecorationData, WorldPath } from "../game/world";
import { WorldDecoration } from "./WorldDecoration";

type WorldPathLayerProps = {
  paths: readonly WorldPath[];
};

type WorldDecorationLayerProps = {
  zoneId: WorldZoneId;
  decorations: readonly WorldDecorationData[];
};

const pixelRect = (rect: { x: number; y: number; width: number; height: number }) => ({
  left: rect.x,
  top: rect.y,
  width: rect.width,
  height: rect.height
});

export const WorldPathLayer = memo(function WorldPathLayer({ paths }: WorldPathLayerProps) {
  return paths.map((worldPath) => (
    <div
      key={worldPath.id}
      className={`world-path world-path--${worldPath.kind}`}
      style={pixelRect(worldPath)}
    />
  ));
});

export const WorldDecorationLayer = memo(function WorldDecorationLayer({
  zoneId,
  decorations
}: WorldDecorationLayerProps) {
  return decorations.map((decoration) => (
    <WorldDecoration key={decoration.id} zoneId={zoneId} decoration={decoration} />
  ));
});
