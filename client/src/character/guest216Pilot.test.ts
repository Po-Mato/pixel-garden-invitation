import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultCharacterAppearance } from '@wedding-game/shared';
import { resolveCharacterLayers } from './assets';
import { guest216PilotIds, resolveGuest216PilotLayer } from './guest216Pilot';

afterEach(() => vi.unstubAllEnvs());
describe('216px twelve-character local candidate pilot', () => {
  it('uses actual reduced frames only for the optional staged world path', () => {
    for (const [preset,id] of Object.entries(guest216PilotIds)) {
      const world=resolveGuest216PilotLayer(preset,true,'world',true)!;
      expect(world.sourceSize).toEqual({width:96,height:144});
      expect(world.walkUrl).toContain(`${id}-runtime.png`);
      expect(world.displaySize.world).toEqual({width:48,height:72});
      for(const mode of ['preview','thumbnail'] as const) {
        const selected=resolveGuest216PilotLayer(preset,true,mode,true)!;
        expect(selected.sourceSize).toEqual({width:192,height:288});
        expect(selected.walkUrl).not.toContain('-runtime.png');
      }
    }
  });
  it('maps all twelve stable preset IDs to distinct directional sheets', () => {
    expect(Object.keys(guest216PilotIds)).toHaveLength(12);
    expect(new Set(Object.values(guest216PilotIds)).size).toBe(12);
    for (const [preset, id] of Object.entries(guest216PilotIds)) {
      const layer=resolveGuest216PilotLayer(preset,true)!;
      expect(layer.walkUrl).toBe(`/__guest216-pilot/${id}.png?v=three-head-216-v1`);
      expect(layer.sourceSize).toEqual({width:192,height:288});
      expect(layer.displaySize.world).toEqual({width:48,height:72});
      expect(layer.displaySize.preview).toEqual({width:96,height:144});
      expect(layer.idleUrl).toBeUndefined();
    }
  });
  it('does not resolve disabled or unknown candidates', () => {
    expect(resolveGuest216PilotLayer('masculine-navy-suit',false)).toBeUndefined();
    expect(resolveGuest216PilotLayer('constructor',true)).toBeUndefined();
  });
  it('integrates only in explicitly enabled development', () => {
    vi.stubEnv('DEV',true);vi.stubEnv('VITE_GUEST216_PILOT','true');vi.stubEnv('VITE_GUEST03_PILOT','false');
    expect(resolveCharacterLayers(defaultCharacterAppearance)[0].walkUrl).toContain('/__guest216-pilot/');
  });
  it('cannot enable candidates in production even with a stale flag', () => {
    vi.stubEnv('DEV',false);vi.stubEnv('VITE_GUEST216_PILOT','true');vi.stubEnv('VITE_GUEST216_RUNTIME_PILOT','true');
    expect(resolveCharacterLayers(defaultCharacterAppearance)[0].walkUrl).not.toContain('/__guest216-pilot/');
  });
});
