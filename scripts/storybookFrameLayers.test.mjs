import test from 'node:test';
import assert from 'node:assert/strict';
import {splitSvgChildren,inspectStorybookFrameLayers,readStorybookFrameLayers} from './lib/storybookFrameLayers.mjs';
import {fileURLToPath} from 'node:url';
test('SVG decomposition keeps complete nested masks and transforms',()=>{
  const parts=['<defs><mask id="m"><g><rect width="1"/></g></mask></defs>','<g transform="rotate(1)"><image href="data:test;base64,abc"/></g>','<image width="1"/>'];
  assert.deepEqual(splitSvgChildren(`<svg>${parts.join('')}</svg>`),parts);
  assert.throws(()=>splitSvgChildren('<svg><g></svg>'));
});
test('custom anchor front and side source mappings reconstruct their actual frames',async()=>{
  const base=fileURLToPath(new URL('../character-assets/rigs/guest-05/storybook-directions-v1/',import.meta.url)).replace(/\/$/,'');
  for(const direction of ['front','left','right','back']){
    const r=await readStorybookFrameLayers(base,direction,1);
    assert.ok(r.layers.some(p=>p.id===`torso-${direction}`));
    assert.ok(r.layers.some(p=>p.id===`neck-${direction}`));
    assert.equal(r.expected.length,192*288*4);
  }
});
test('guest07 source layer mapping reconstructs the frame exactly and identifies the head',async()=>{
  const base=fileURLToPath(new URL('../character-assets/rigs/guest-07/storybook-source-v1/',import.meta.url));
  const r=await inspectStorybookFrameLayers(base,'right',3,[[24,23],[0,0]]);
  assert.equal(r.exactFrameReconstruction,true);
  assert.equal(r.ownership[0].dominant,'head-above-body');
  assert.equal(r.ownership[1].dominant,null);
  assert.match(r.sourceFrameRgbaSha256,/^[a-f0-9]{64}$/);
  await assert.rejects(inspectStorybookFrameLayers(base,'right',3,[[48,0]]));
});
