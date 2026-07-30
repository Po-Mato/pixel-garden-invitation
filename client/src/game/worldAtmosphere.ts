import type { WorldZoneId } from "@wedding-game/shared";
import type { WorldAtmosphereKind } from "./worldVisuals";

export type WorldAmbientMotion = "full" | "reduced" | "minimal";

export type WorldAtmosphereParticle = {
  id: string;
  kind: WorldAtmosphereKind;
  x: number;
  y: number;
  size: number;
  delayMs: number;
  durationMs: number;
  drift: number;
};

const particleCountByMotion: Record<WorldAmbientMotion, number> = {
  full: 16,
  reduced: 7,
  minimal: 0
};

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomUnit(seed: number): number {
  const mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  return ((mixed ^ (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed))) >>> 0) / 4294967295;
}

export function createWorldAtmosphereParticles(
  zoneId: WorldZoneId,
  kinds: readonly WorldAtmosphereKind[],
  motion: WorldAmbientMotion
): WorldAtmosphereParticle[] {
  const count = particleCountByMotion[motion];
  if (count === 0 || kinds.length === 0) return [];
  const zoneSeed = hashSeed(zoneId);

  return Array.from({ length: count }, (_, index) => {
    const seed = zoneSeed + index * 1013;
    const kind = kinds[index % kinds.length];
    return {
      id: `${zoneId}-${kind}-${index}`,
      kind,
      x: 7 + randomUnit(seed + 1) * 86,
      y: 8 + randomUnit(seed + 2) * 78,
      size: 3 + Math.round(randomUnit(seed + 3) * (kind === "streak" ? 8 : 4)),
      delayMs: -Math.round(randomUnit(seed + 4) * 5_000),
      durationMs: 2_800 + Math.round(randomUnit(seed + 5) * 3_600),
      drift: 8 + Math.round(randomUnit(seed + 6) * 18)
    };
  });
}
