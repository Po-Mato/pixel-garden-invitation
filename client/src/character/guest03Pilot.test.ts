import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolveGuest03PilotLayer } from './guest03Pilot';
import { resolveCharacterLayers } from './assets';
import { getWalkFrameStyle } from './frame';
import { createElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import { CharacterSprite } from '../components/CharacterSprite';

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
describe('guest03 local pilot isolation', () => {
  it('stays on neutral without the legacy idle-sheet blink animation', () => {
    vi.stubEnv('DEV',true);vi.stubEnv('VITE_GUEST03_PILOT','true');
    const {container} = render(createElement(CharacterSprite, {appearance:{presetId:'masculine-navy-suit'},direction:'down',moving:false}));
    expect(container.querySelector('.character-sprite--idle-front')).toBeNull();
    expect(container.querySelector('.character-layer')).toHaveStyle({backgroundPosition:'-192px 0px'});
  });
  it('requires opt-in and the exact preset', () => {
    expect(resolveGuest03PilotLayer('masculine-navy-suit', false)).toBeUndefined();
    expect(resolveGuest03PilotLayer('feminine-long-wave-dress', true)).toBeUndefined();
  });
  it('uses the real frame mapping and required display sizes', () => {
    const p = resolveGuest03PilotLayer('masculine-navy-suit', true)!;
    expect(p.walkUrl).toBe('/__guest03-pilot/walk.png?v=three-head-216-v1');
    expect(p.displaySize.world).toEqual({width:48,height:72});
    expect(p.displaySize.preview).toEqual({width:96,height:144});
    expect(p.idleUrl).toBeUndefined();
    for (const [direction,row] of [['down',0],['left',1],['right',2],['up',3]] as const)
      expect(getWalkFrameStyle(direction,1,p.sourceSize)).toEqual({x:-192,y:row===0?0:-288*row});
  });
  it('cannot activate in production even with an environment flag', () => {
    vi.stubEnv('DEV', false);vi.stubEnv('VITE_GUEST03_PILOT','true');
    expect(resolveCharacterLayers({presetId:'masculine-navy-suit'})[0].walkUrl).not.toContain('__guest03-pilot');
  });
  it('only overrides guest 03 in the opt-in development server', () => {
    vi.stubEnv('DEV',true);vi.stubEnv('VITE_GUEST03_PILOT','true');
    expect(resolveCharacterLayers({presetId:'masculine-navy-suit'})[0].walkUrl).toContain('__guest03-pilot');
    expect(resolveCharacterLayers({presetId:'feminine-long-wave-dress'})[0].walkUrl).not.toContain('__guest03-pilot');
  });
});
