import type { ResolvedCharacterLayer } from './assets';

export function resolveGuest03PilotLayer(presetId: string, enabled: boolean): ResolvedCharacterLayer | undefined {
  if (!enabled || presetId !== 'masculine-navy-suit') return undefined;
  const walkUrl = '/__guest03-pilot/walk.png?v=three-head-216-v1';
  return {
    slot: 'base', walkUrl, fallbackWalkUrl: walkUrl,
    sourceSize: { width: 192, height: 288 },
    displaySize: {
      world: { width: 48, height: 72 },
      preview: { width: 96, height: 144 },
      thumbnail: { width: 48, height: 72 }
    }
  };
}
