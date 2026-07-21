import type { WorldZoneId } from "@wedding-game/shared";
import { resolveWorldVisual } from "../game/worldVisuals";

type WorldMapArtworkProps = {
  zoneId: WorldZoneId;
  onLoadStateChange?: (loaded: boolean) => void;
};

export function WorldMapArtwork({ zoneId, onLoadStateChange }: WorldMapArtworkProps) {
  const visual = resolveWorldVisual(zoneId);

  return (
    <div className="world-map-artwork" style={{ backgroundColor: visual.fallbackColor }} aria-hidden="true">
      <img
        key={visual.backgroundUrl}
        className="world-map-artwork__background"
        src={visual.backgroundUrl}
        alt=""
        decoding="async"
        fetchPriority="high"
        loading="eager"
        draggable={false}
        onLoad={() => { onLoadStateChange?.(true); }}
        onError={(event) => {
          event.currentTarget.hidden = true;
          onLoadStateChange?.(false);
        }}
      />
      {visual.effects.map((effect) => (
        <span key={effect} className={`world-map-effect world-map-effect--${effect}`} />
      ))}
    </div>
  );
}
