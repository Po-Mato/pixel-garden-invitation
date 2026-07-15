import type { WorldZoneId } from "@wedding-game/shared";
import { resolveWorldVisual } from "../game/worldVisuals";

export function WorldMapArtwork({ zoneId }: { zoneId: WorldZoneId }) {
  const visual = resolveWorldVisual(zoneId);

  return (
    <div className="world-map-artwork" style={{ backgroundColor: visual.fallbackColor }} aria-hidden="true">
      <img
        key={visual.backgroundUrl}
        className="world-map-artwork__background"
        src={visual.backgroundUrl}
        alt=""
        draggable={false}
        onError={(event) => { event.currentTarget.hidden = true; }}
      />
      {visual.effects.map((effect) => (
        <span key={effect} className={`world-map-effect world-map-effect--${effect}`} />
      ))}
    </div>
  );
}
