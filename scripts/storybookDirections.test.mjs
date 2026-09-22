import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-05/storybook-directions-v1');
for(const script of ['render-storybook-direction-heads.mjs','render-storybook-direction-bodies.mjs','render-storybook-direction-walk.mjs'])execFileSync(process.execPath,[path.join(root,'scripts',script)]);
const raw=async(d,n)=>sharp(path.join(base,`generated/${d}-walk-${n}.png`)).ensureAlpha().raw().toBuffer();
for(const direction of ['left','right','back']){
  test(`${direction}: fixed canvas, neutral repetition, opposite stride`,async()=>{
    for(let n=1;n<=4;n++){const m=await sharp(path.join(base,`generated/${direction}-walk-${n}.png`)).metadata();assert.equal(m.width,192);assert.equal(m.height,288);}
    assert.deepEqual(await raw(direction,2),await raw(direction,4));assert.notDeepEqual(await raw(direction,1),await raw(direction,3));
  });
  test(`${direction}: fixed head and exact ground contact`,async()=>{
    const ref=await raw(direction,2);
    for(let n=1;n<=4;n++){
      const data=await raw(direction,n);assert.deepEqual(data.subarray(0,192*126*4),ref.subarray(0,192*126*4));
      let bottom=-1;for(let y=230;y<288;y++)for(let x=0;x<192;x++)if(data[(y*192+x)*4+3]>=128)bottom=y;
      assert.equal(bottom,269,'last opaque foot row must be immediately above baseline 270');
    }
  });
  test(`${direction}: 12 explicit joints match shared projection`,async()=>{
    const skeleton=JSON.parse(await fs.readFile(path.join(root,'character-assets/rigs/common-three-head-216-v1/skeleton.json')));
    const bindings=JSON.parse(await fs.readFile(path.join(base,`generated/${direction}-joint-bindings.json`)));
    assert.equal(bindings.parts.length,12);
    for(const p of bindings.parts){assert.deepEqual(p.pivot,skeleton.projections[direction].bones[p.id].pivot);assert.equal(p.parent,skeleton.projections[direction].bones[p.id].parent);}
  });
}
test('study sheet resolution and runtime exclusion',async()=>{
  const high=await sharp(path.join(base,'generated/guest05-walk-study.png')).metadata();assert.equal(high.width,768);assert.equal(high.height,1152);
  const game=await sharp(path.join(base,'generated/guest05-walk-study-game.png')).metadata();assert.equal(game.width,192);assert.equal(game.height,288);
  const audit=JSON.parse(await fs.readFile(path.join(base,'generated/walk-audit.json')));assert.equal(audit.runtimeEligible,false);assert.equal(audit.visualApproved,false);
});
test('visible asymmetric bags stay attached to anatomical left hand',async()=>{
  const rig=JSON.parse(await fs.readFile(path.join(base,'body-registration.json')));assert.equal(rig.mirrored,false);
  for(const direction of ['left','right','back']){const bag=rig.parts.find(p=>p.id===`bag-${direction}`);assert.equal(bag.parent,'handLeft');assert.equal(bag.bodySide,'left');}
});
test('left clutch stays truly occluded rather than teleporting or changing hands',async()=>{
  const rig=JSON.parse(await fs.readFile(path.join(base,'body-registration.json'))),bag=rig.parts.find(p=>p.id==='bag-left');
  assert.equal(bag.visibility,'fully-occluded-by-skirt');assert.deepEqual(bag.pivot,[90,180.418605]);
  const a=await sharp(path.join(base,'generated/bag-left-registered.svg')).ensureAlpha().extractChannel(3).raw().toBuffer();
  const skirt=await sharp(path.join(base,'generated/skirt-left-registered.svg')).ensureAlpha().extractChannel(3).raw().toBuffer();
  assert.ok(a.some(v=>v>0),'hidden bag still has real source coverage');
  for(let i=0;i<a.length;i++)if(a[i])assert.equal(skirt[i],255,'all hidden bag material must lie behind opaque skirt');
});
test('directional head source layers preserve coverage and opaque artwork',async()=>{
  for(const direction of ['left','right','back']){
    const dir=path.join(base,'generated/head-layers',direction),audit=JSON.parse(await fs.readFile(path.join(dir,'audit.json')));
    assert.equal(audit.completeCoverage,true);assert.equal(audit.composedAlphaUnchanged,true);assert.equal(audit.opaqueRgbUnchanged,true);
    assert.equal(audit.independentMotionAllowed,false);
    for(const id of ['face','frontHair','backHair']){
      const data=await sharp(path.join(dir,`${id}.png`)).ensureAlpha().raw().toBuffer();
      for(let i=0;i<data.length;i+=4)if(data[i+3]===0)assert.equal(data[i]+data[i+1]+data[i+2],0);
    }
  }
});
