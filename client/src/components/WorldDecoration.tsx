import { memo } from "react";
import type { WorldZoneId } from "@wedding-game/shared";
import type { WorldDecoration as WorldDecorationData } from "../game/world";
import { resolveWorldMapAsset, worldDepth } from "../game/worldVisuals";

type WorldDecorationProps = {
  zoneId: WorldZoneId;
  decoration: WorldDecorationData;
};

export const WorldDecoration = memo(function WorldDecoration({ zoneId, decoration }: WorldDecorationProps) {
  if (!decoration.asset) return null;
  const depthY = decoration.depthY ?? decoration.y + decoration.height;
  const shadowHeight = Math.max(6, Math.min(14, decoration.height * 0.08));

  return (
    <>
      {decoration.depthMode !== "overhead" ? (
        <span
          className="world-decoration-ground-shadow"
          data-shadow-for={decoration.id}
          aria-hidden="true"
          style={{
            left: decoration.x + decoration.width * 0.14,
            top: depthY - shadowHeight / 2,
            width: decoration.width * 0.72,
            height: shadowHeight,
            zIndex: worldDepth(depthY) - 1
          }}
        />
      ) : null}
      <img
        className="world-decoration world-decoration--asset"
        data-decoration={decoration.kind}
        data-decoration-label={decoration.label}
        src={resolveWorldMapAsset(zoneId, decoration.asset)}
        alt=""
        decoding="async"
        draggable={false}
        aria-hidden="true"
        style={{
          left: decoration.x,
          top: decoration.y,
          width: decoration.width,
          height: decoration.height,
          zIndex: worldDepth(depthY)
        }}
        onError={(event) => { event.currentTarget.hidden = true; }}
      />
    </>
  );
});
