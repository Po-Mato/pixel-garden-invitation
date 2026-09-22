import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
for(const guest of ['guest-01','guest-07']){
const base=new URL(`../character-assets/rigs/${guest}/storybook-source-v1/`,import.meta.url);
const rig=JSON.parse(await fs.readFile(new URL('body-registration.json',base)));
const skeleton=JSON.parse(await fs.readFile(new URL(rig.skeleton,base)));
const arms=rig.parts.filter(p=>p.id.startsWith('arm'));
if(guest==='guest-01')test('guest01 anatomical binding changes only source shoulder/wrist landmarks and joint masks',async()=>{
  const before=JSON.parse(await fs.readFile(new URL('review/arm-binding-v2/before-registration.json',base)));
  const normalized=structuredClone(rig);
  for(const p of normalized.parts.filter(p=>p.id.startsWith('arm'))){
    const previous=before.parts.find(b=>b.id===p.id);
    assert.notDeepEqual(p.sourceEnd,previous.sourceEnd);
    assert.ok(p.sourceEnd[1]<previous.sourceEnd[1],'Wrist landmark must replace the lower palm landmark');
    p.sourcePivot=previous.sourcePivot;p.sourceEnd=previous.sourceEnd;delete p.jointMasks;
  }
  assert.deepEqual(normalized,before,'No costume, skeleton, bag, limb width or motion changes');
});
test(`${guest} independently binds eight original sleeves to fixed shoulder and wrist bones`,async()=>{
  assert.equal(arms.length,8);
  assert.equal(new Set(arms.map(p=>p.source)).size,8);
  for(const p of arms){
    const bones=p.direction==='front'?skeleton.bones:skeleton.projections[p.direction].bones;
    assert.equal(p.mirrored,false);
    assert.deepEqual(p.pivot,bones[p.parent].pivot);
    assert.deepEqual(p.targetEnd,bones[p.parent.replace('upperArm','hand')].pivot);
    const {data,info}=await sharp(await fs.readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
    for(const [x,y] of [p.sourcePivot,p.sourceEnd])assert.ok(data[Math.round(y)*info.width+Math.round(x)]>=128,p.id+': attachment must be inside its own source silhouette');
  }
});
test(`${guest} uses 24 editable curved joint masks rather than the default horizontal bands`,async()=>{
  const files=arms.flatMap(p=>Object.values(p.jointMasks));
  assert.equal(new Set(files).size,24);
  for(const p of arms){
    assert.deepEqual(Object.keys(p.jointMasks).sort(),['forearm','hand','upperArm']);
    const bindings=JSON.parse(await fs.readFile(new URL('generated/'+p.direction+'-joint-bindings.json',base))).parts.filter(b=>b.source===p.id);
    assert.equal(bindings.length,3);
    for(const b of bindings){assert.equal(b.region,null);assert.equal(b.overlap,null);assert.ok(files.includes(b.sourceMask));}
  }
  for(const file of files){
    const bytes=await fs.readFile(new URL(file,base));
    assert.ok(!/<(?:image|script|foreignObject)\b|\b(?:href|xlink:href)\s*=/i.test(bytes.toString()));
    assert.match(bytes.toString(),/Q/);
    const meta=await sharp(bytes).metadata();assert.equal(meta.width,192);assert.equal(meta.height,288);
  }
});
test(`${guest} neutral joint masks cover every opaque source-arm pixel without replacing source artwork`,async()=>{
  for(const p of arms){
    const full=await sharp(await fs.readFile(new URL('generated/'+p.id+'-registered.svg',base))).ensureAlpha().extractChannel(3).raw().toBuffer();
    const masks=await Promise.all(Object.values(p.jointMasks).map(async f=>sharp(await fs.readFile(new URL(f,base))).ensureAlpha().extractChannel(3).raw().toBuffer()));
    for(let i=0;i<full.length;i++)if(full[i]>=128)assert.ok(masks.some(m=>m[i]===255),p.id+': uncovered source pixel '+i);
  }
});
}
