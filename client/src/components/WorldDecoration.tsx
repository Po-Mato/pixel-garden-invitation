import type { WorldZoneId } from "@wedding-game/shared";
import type { WorldDecoration as WorldDecorationData } from "../game/world";
import { resolveWorldMapAsset, worldDepth } from "../game/worldVisuals";

type WorldDecorationProps = {
  zoneId: WorldZoneId;
  decoration: WorldDecorationData;
};

export function WorldDecoration({ zoneId, decoration }: WorldDecorationProps) {
  if (!decoration.asset) return null;
  const depthY = decoration.depthY ?? decoration.y + decoration.height;

  return (
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
  );
}
