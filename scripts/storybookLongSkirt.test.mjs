import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const common=path.join(root,'character-assets/rigs/common-three-head-216-v1');
const base=path.join(root,'character-assets/rigs/guest-06/storybook-source-v1');
test('long-skirt source keys share waistband pivot and exact neutral pair',async()=>{
  const cloth=JSON.parse(await fs.readFile(path.join(common,'animations/painted-long-skirt-v1.json')));
  assert.equal(cloth.parent,'pelvis');assert.deepEqual(cloth.pivot,[96,171]);
  for(const direction of ['front','left','right','back']){
    const keys=cloth.directions[direction];assert.equal(keys.length,4);assert.ok(keys.every(Number.isFinite));
    assert.equal(keys[1],0);assert.equal(keys[3],0);assert.notEqual(keys[0],0);assert.equal(keys[0],-keys[2]);
    // Under one source pixel of hem travel at the registered 82px skirt length.
    assert.ok(82*Math.sin(Math.abs(keys[0])*Math.PI/180)<1);
  }
});
test('guest 06 uses four actual skirts and common cloth motion, not frame repairs',async()=>{
  const rig=JSON.parse(await fs.readFile(path.join(base,'body-registration.json')));
  assert.equal(rig.clothAnimation,'animations/painted-long-skirt-v1.json');
  const skirts=rig.parts.filter(p=>p.id.startsWith('skirt-'));
  assert.equal(skirts.length,4);assert.equal(new Set(skirts.map(p=>p.source)).size,4);
  for(const p of skirts){assert.equal(p.parent,'pelvis');assert.equal(p.mirrored,false);assert.deepEqual(p.pivot,[96,171]);assert.equal(p.scale,0.06);}
  assert.equal(rig.runtimeEligible,false);
});
