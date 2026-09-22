import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-05/storybook-body-v1');
for(const script of ['render-storybook-front-neutral.mjs','render-storybook-front-walk.mjs'])execFileSync(process.execPath,[path.join(root,'scripts',script)]);
const raw=async n=>sharp(path.join(base,`generated/front-walk-${n}.png`)).ensureAlpha().raw().toBuffer();
test('four 192x288 frames, exact neutral repetition, distinct opposite strides',async()=>{
  for(let n=1;n<=4;n++){const m=await sharp(path.join(base,`generated/front-walk-${n}.png`)).metadata();assert.equal(m.width,192);assert.equal(m.height,288);}
  assert.deepEqual(await raw(2),await raw(4));assert.notDeepEqual(await raw(1),await raw(3));
});
test('head and upper torso do not deform or move across walking frames',async()=>{
  const reference=await raw(2);
  for(const n of [1,3,4]){const frame=await raw(n);for(let y=54;y<158;y++)for(let x=78;x<114;x++){const p=(y*192+x)*4;assert.deepEqual(frame.subarray(p,p+4),reference.subarray(p,p+4));}}
});
test('foot silhouettes alternate depth and preserve common overall baseline',async()=>{
  const bottoms=[];
  for(let n=1;n<=4;n++){const frame=await raw(n);const side=[-1,-1];for(let y=235;y<288;y++)for(let x=70;x<124;x++)if(frame[(y*192+x)*4+3]>=128)side[x<96?0:1]=y;bottoms.push(side);}
  assert.equal(Math.max(...bottoms[0]),Math.max(...bottoms[1]));assert.equal(Math.max(...bottoms[2]),Math.max(...bottoms[1]));
  assert.ok(bottoms[0][1]>bottoms[0][0]);assert.ok(bottoms[2][0]>bottoms[2][1]);
});
test('all joint bindings use shared skeleton pivots and explicit parents',async()=>{
  const bindings=JSON.parse(await fs.readFile(path.join(base,'front-joint-bindings.json')));
  const rig=JSON.parse(await fs.readFile(path.join(base,'front-registration.json')));
  const skeleton=JSON.parse(await fs.readFile(path.resolve(base,rig.skeleton)));
  assert.equal(bindings.parts.length,12);for(const b of bindings.parts){assert.deepEqual(b.pivot,skeleton.bones[b.id].pivot);assert.equal(b.parent,skeleton.bones[b.id].parent);}
  assert.equal(rig.parts.find(p=>p.id==='bag').parent,'handLeft');assert.equal(rig.mirrored,false);
});
test('prototype cannot be mistaken for runtime approved',async()=>{
  const audit=JSON.parse(await fs.readFile(path.join(base,'generated/walk-audit.json')));assert.equal(audit.runtimeEligible,false);assert.equal(audit.visualApproved,false);
});
