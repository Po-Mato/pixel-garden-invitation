import { afterEach, describe, expect, it, vi } from 'vitest';
import { guestCharacterPresets } from '@wedding-game/shared';
import { resolveCharacterLayers, resolveCharacterPortraitUrl } from './assets';
import { coupleStyleRevision, resolveCoupleStyleLayer } from './coupleStyleAssets';
afterEach(() => vi.unstubAllEnvs());
const enable = (dev = true) => {
  vi.stubEnv('DEV', dev);
  vi.stubEnv('VITE_COUPLE_STYLE_PILOT', 'true');
};
describe('approved couple-style production package', () => {
  it('routes all twelve presets and both animation sheets without multiplying world geometry', () => {
    enable();
    expect(guestCharacterPresets).toHaveLength(12);
    for (const preset of guestCharacterPresets) {
      for (const mode of ['world', 'preview', 'thumbnail'] as const) {
        const layer = resolveCharacterLayers({presetId:preset.id}, '/invitation/', mode)[0];
        const prefix = mode === 'world' ? '' : 'preview/';
        for (const kind of ['walk', 'idle'] as const) {
          expect(layer[`${kind}Url`]).toBe(`/invitation/characters/generated/couple-style-v1/${prefix}${preset.id}__${kind}.png?v=${coupleStyleRevision}`);
        }
        expect(layer.sourceSize).toEqual(mode === 'world' ? {width:96,height:144} : {width:192,height:288});
        expect(layer.displaySize).toEqual({world:{width:48,height:72},thumbnail:{width:48,height:72},preview:{width:96,height:144}});
      }
      expect(resolveCharacterPortraitUrl({presetId:preset.id}, '/invitation')).toBe(`/invitation/characters/generated/couple-style-v1/portraits/${preset.id}.png?v=${coupleStyleRevision}`);
    }
  });
  it('takes explicit priority over historical pilot flags for every preset', () => {
    enable();vi.stubEnv('VITE_GUEST03_PILOT','true');vi.stubEnv('VITE_GUEST216_PILOT','true');
    for (const preset of guestCharacterPresets) expect(resolveCharacterLayers({presetId:preset.id},'./')[0].walkUrl).toContain('/couple-style-v1/');
  });
  it('uses reviewed sprite and portrait URLs in production without opt-in', () => {
    vi.stubEnv('DEV',false);vi.stubEnv('VITE_COUPLE_STYLE_PILOT','false');
    for (const preset of guestCharacterPresets) {
      expect(resolveCharacterLayers({presetId:preset.id},'./')[0].walkUrl).toContain('couple-style-v1');
      expect(resolveCharacterPortraitUrl({presetId:preset.id},'./')).toContain('couple-style-v1');
    }
  });
  it('uses the package by default and rejects unknown direct preset requests', () => {
    vi.stubEnv('DEV',true);vi.stubEnv('VITE_COUPLE_STYLE_PILOT','false');
    expect(resolveCharacterLayers({presetId:guestCharacterPresets[0].id},'./')[0].walkUrl).toContain('couple-style-v1');
    expect(resolveCoupleStyleLayer('constructor','./','world')).toBeUndefined();
  });
});

it('falls back to the default reviewed preset at the same resolution and revision', () => {
  const preset=guestCharacterPresets[2];
  for (const mode of ['world','preview','thumbnail'] as const) {
    const layer=resolveCharacterLayers({presetId:preset.id}, '/invite', mode)[0];
    const prefix=mode==='world'?'':'preview/';
    for(const kind of ['walk','idle'] as const) expect(layer[kind==='walk'?'fallbackWalkUrl':'fallbackIdleUrl']).toBe(`/invite/characters/generated/couple-style-v1/${prefix}feminine-long-wave-dress__${kind}.png?v=${coupleStyleRevision}`);
  }
  expect(resolveCharacterPortraitUrl({presetId:'missing'},'/invite')).toContain('/portraits/feminine-long-wave-dress.png?v='+coupleStyleRevision);
});
