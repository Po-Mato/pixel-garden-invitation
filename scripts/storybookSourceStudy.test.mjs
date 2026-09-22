import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const guestId=process.env.STORYBOOK_GUEST_ID||'guest-03';
assert.match(guestId,/^guest-[0-9]{2}$/);
const base=path.join(root,'character-assets/rigs',guestId,'storybook-source-v1');
const bodyRig=JSON.parse(await fs.readFile(path.join(base,'body-registration.json')));
assert.ok(['tailored','dress','femaleHanbok','maleHanbok'].includes(bodyRig.family));
for(const script of ['render-storybook-head-study.mjs','render-storybook-body-study.mjs','render-storybook-walk-study.mjs'])execFileSync(process.execPath,[path.join(root,'scripts',script),guestId]);
const raw=async (n,direction='front')=>sharp(path.join(base,`generated/${direction}-walk-${n}.png`)).ensureAlpha().raw().toBuffer();
test('painted source study has four independent directional head sources',async()=>{
  const rig=JSON.parse(await fs.readFile(path.join(base,'head-registration.json')));assert.deepEqual(rig.heads.map(h=>h.direction),['front','left','right','back']);
  assert.equal(new Set(rig.heads.map(h=>h.source)).size,4);for(const h of rig.heads){assert.equal(h.parent,'head');assert.equal(h.mirrored,false);const m=await sharp(path.join(base,`generated/head-${h.direction}-192x288.png`)).metadata();assert.equal(m.width,192);assert.equal(m.height,288);}
});
test('front frame size, neutral pair and opposite strides',async()=>{
  for(let n=1;n<=4;n++){const m=await sharp(path.join(base,`generated/front-walk-${n}.png`)).metadata();assert.equal(m.width,192);assert.equal(m.height,288);}
  assert.deepEqual(await raw(2),await raw(4));assert.notDeepEqual(await raw(1),await raw(3));
});
test('head stays rigid and alternating feet meet baseline 270',async()=>{
  const reference=await raw(2),bottoms=[];
  for(let n=1;n<=4;n++){
    const data=await raw(n);assert.deepEqual(data.subarray(0,192*126*4),reference.subarray(0,192*126*4));
    const sides=[-1,-1];for(let y=235;y<288;y++)for(let x=50;x<140;x++)if(data[(y*192+x)*4+3]>=128)sides[x<96?0:1]=y;
    assert.equal(Math.max(...sides),269);bottoms.push(sides);
  }
  assert.ok(bottoms[0][1]>bottoms[0][0]);assert.ok(bottoms[2][0]>bottoms[2][1]);
});
test('twelve source joint bindings use the fixed common skeleton',async()=>{
  const skeleton=JSON.parse(await fs.readFile(path.join(root,'character-assets/rigs/common-three-head-216-v1/skeleton.json')));
  const bindings=JSON.parse(await fs.readFile(path.join(base,'generated/front-joint-bindings.json')));assert.equal(bindings.parts.length,12);
  for(const p of bindings.parts){assert.deepEqual(p.pivot,skeleton.bones[p.id].pivot);assert.equal(p.parent,skeleton.bones[p.id].parent);}
});
test('source study is not marked approved or runtime ready',async()=>{
  for(const file of ['head-audit.json','body-audit.json','walk-audit.json']){const audit=JSON.parse(await fs.readFile(path.join(base,'generated',file)));assert.equal(audit.runtimeEligible,false);assert.equal(audit.visualApproved,false);}
});
test('whole arm source endpoints bind to the projected shoulder and hand',async()=>{
  const skeleton=JSON.parse(await fs.readFile(path.resolve(base,bodyRig.skeleton)));
  for(const p of bodyRig.parts.filter(p=>p.sourceEnd)){
    const bones=p.direction==='front'?skeleton.bones:skeleton.projections[p.direction].bones;
    assert.deepEqual(p.pivot,bones[p.parent].pivot,p.id+': shoulder');
    assert.deepEqual(p.targetEnd,bones[p.parent.replace('upperArm','hand')].pivot,p.id+': palm endpoint');
  }
});
test('shared anatomical height is 72 plus 144 with fixed crown, chin and ground planes',async()=>{
  const common=JSON.parse(await fs.readFile(path.join(root,'character-assets/rigs/common-three-head-216-v1/skeleton.json')));
  assert.equal(common.geometry.headHeight,72);
  assert.equal(common.geometry.bodyHeight,144);
  assert.equal(common.geometry.characterHeight,216);
  assert.deepEqual(common.canvas,[192,288]);
  for(const direction of ['front','left','right','back']){
    for(let n=1;n<=4;n++){
      const data=await raw(n,direction);let top=288;
      for(let y=0;y<288;y++)for(let x=0;x<192;x++)if(data[(y*192+x)*4+3]>=128)top=Math.min(top,y);
      assert.equal(top,54,direction+': crown plane');
      // Neck stays covered by skin/collar, rather than silently becoming transparent.
      for(let y=124;y<=140;y++)assert.ok(data[(y*192+96)*4+3]>=128,direction+': neck connection at '+y);
    }
  }
});
for(const direction of ['left','right','back']){
  test(`${direction}: four frames, fixed head, exact neutral and baseline`,async()=>{
    const reference=await raw(2,direction);
    for(let n=1;n<=4;n++){
      const file=path.join(base,`generated/${direction}-walk-${n}.png`),m=await sharp(file).metadata();assert.equal(m.width,192);assert.equal(m.height,288);
      const data=await raw(n,direction);assert.deepEqual(data.subarray(0,192*126*4),reference.subarray(0,192*126*4));
      let bottom=-1;for(let y=235;y<288;y++)for(let x=40;x<150;x++)if(data[(y*192+x)*4+3]>=128)bottom=y;
      assert.equal(bottom,269,`${direction} frame ${n}: sole must end at baseline 270`);
    }
    assert.deepEqual(await raw(2,direction),await raw(4,direction));assert.notDeepEqual(await raw(1,direction),await raw(3,direction));
  });
  test(`${direction}: explicit projected joints and anatomical alternating feet`,async()=>{
    const common=path.join(root,'character-assets/rigs/common-three-head-216-v1');
    const skeleton=JSON.parse(await fs.readFile(path.join(common,'skeleton.json'))),bones=skeleton.projections[direction].bones;
    const bindings=JSON.parse(await fs.readFile(path.join(base,`generated/${direction}-joint-bindings.json`)));assert.equal(bindings.parts.length,12);
    for(const p of bindings.parts){assert.deepEqual(p.pivot,bones[p.id].pivot);assert.equal(p.parent,bones[p.id].parent);}
    const motion=JSON.parse(await fs.readFile(path.join(common,`animations/${bodyRig.family}-${direction}.json`)));
    assert.ok(['Left','Right'].includes(motion.frames[0].forward));assert.notEqual(motion.frames[0].forward,motion.frames[2].forward);
    for(const f of motion.frames)for(const side of ['Left','Right'])assert.equal((f.rotations['thigh'+side]||0)+(f.rotations['calf'+side]||0)+(f.rotations['shoe'+side]||0),0,'no twisted ankle: shoe stays horizontal');
  });
}
test('complete study sheet is 768x1152 and directional costumes are not mirrored',async()=>{
  const m=await sharp(path.join(base,'generated/walk-study.png')).metadata();assert.equal(m.width,768);assert.equal(m.height,1152);
  const rig=JSON.parse(await fs.readFile(path.join(base,'body-registration.json')));
  assert.deepEqual(rig.walkDirections,['front','left','right','back']);
  const torsos=rig.parts.filter(p=>p.id.startsWith('torso-'));assert.equal(new Set(torsos.map(p=>p.source)).size,4);
  for(const p of rig.parts)assert.equal(p.mirrored,false);
  for(const [label,width,height] of [['selection',384,576],['game',192,288]]){const small=await sharp(path.join(base,`generated/walk-study-${label}.png`)).metadata();assert.equal(small.width,width);assert.equal(small.height,height);}
});
test('four directional source head partitions retain painted coverage and colors',async()=>{
  for(const direction of ['front','left','right','back']){
    const dir=path.join(base,'generated/head-layers',direction),audit=JSON.parse(await fs.readFile(path.join(dir,'audit.json')));
    assert.equal(audit.completeCoverage,true);assert.equal(audit.composedAlphaUnchanged,true);assert.equal(audit.opaqueRgbUnchanged,true);assert.equal(audit.independentMotionAllowed,false);
    for(const part of ['face','frontHair','backHair']){const data=await sharp(path.join(dir,`${part}.png`)).ensureAlpha().raw().toBuffer();for(let i=0;i<data.length;i+=4)if(data[i+3]===0)assert.equal(data[i]+data[i+1]+data[i+2],0);}
  }
});
