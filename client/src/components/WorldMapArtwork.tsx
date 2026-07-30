import type { CSSProperties } from "react";
import type { WorldZoneId } from "@wedding-game/shared";
import { createWorldAtmosphereParticles, type WorldAmbientMotion } from "../game/worldAtmosphere";
import { resolveWorldVisual } from "../game/worldVisuals";

type WorldMapArtworkProps = {
  zoneId: WorldZoneId;
  ambientMotion?: WorldAmbientMotion;
  onLoadStateChange?: (loaded: boolean) => void;
};

type AmbientParticleStyle = CSSProperties & {
  "--ambient-x": string;
  "--ambient-y": string;
  "--ambient-size": string;
  "--ambient-delay": string;
  "--ambient-duration": string;
  "--ambient-drift": string;
};

export function WorldMapArtwork({ zoneId, ambientMotion = "full", onLoadStateChange }: WorldMapArtworkProps) {
  const visual = resolveWorldVisual(zoneId);
  const particles = createWorldAtmosphereParticles(zoneId, visual.atmosphere, ambientMotion);

  return (
    <div
      className="world-map-artwork"
      data-zone={zoneId}
      data-texture={visual.texture}
      data-ambient-motion={ambientMotion}
      style={{ backgroundColor: visual.fallbackColor }}
      aria-hidden="true"
    >
      <img
        key={visual.backgroundUrl}
        className="world-map-artwork__background"
        src={visual.backgroundUrl}
        alt=""
        decoding="async"
        {...{ fetchpriority: "high" }}
        loading="eager"
        draggable={false}
        onLoad={() => { onLoadStateChange?.(true); }}
        onError={(event) => {
          event.currentTarget.hidden = true;
          onLoadStateChange?.(false);
        }}
      />
      <span className="world-map-artwork__texture" />
      {visual.effects.map((effect) => (
        <span key={effect} className={`world-map-effect world-map-effect--${effect}`} />
      ))}
      <span className="world-map-atmosphere">
        {particles.map((particle) => (
          <i
            key={particle.id}
            className={`world-map-atmosphere__particle world-map-atmosphere__particle--${particle.kind}`}
            style={{
              "--ambient-x": `${particle.x}%`,
              "--ambient-y": `${particle.y}%`,
              "--ambient-size": `${particle.size}px`,
              "--ambient-delay": `${particle.delayMs}ms`,
              "--ambient-duration": `${particle.durationMs}ms`,
              "--ambient-drift": `${particle.drift}px`
            } as AmbientParticleStyle}
          />
        ))}
      </span>
    </div>
  );
}
