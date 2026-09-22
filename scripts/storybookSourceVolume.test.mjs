import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sourceVolumeBinding} from './lib/storybookSourceVolume.mjs';
test('guest01 limb refinement preserves its own original bindings and excludes costume/head/accessories',async()=>{
  const base=new URL('../character-assets/rigs/guest-01/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('body-registration.json',base)));
  const before=JSON.parse(await readFile(new URL('review/soft-limbs-v1/before-registration.json',base)));
  const normalized=structuredClone(rig);delete normalized.sourceVolume;
  for(const p of normalized.parts){
    delete p.sourceWidth;
    if(p.id.startsWith('arm')){
      // The subsequent anatomical-binding revision changes only these authored
      // source landmarks/masks; its attachment and coverage tests live in ArmBinding.
      const original=before.parts.find(b=>b.id===p.id);
      p.sourcePivot=original.sourcePivot;p.sourceEnd=original.sourceEnd;
      delete p.jointMasks;
    }
  }
  assert.deepEqual(normalized,before);
  assert.deepEqual(rig.sourceVolume,{arm:1.18});
  const overrides=rig.parts.filter(p=>p.sourceWidth!==undefined);
  assert.equal(overrides.length,6);
  for(const p of rig.parts){
    const b=sourceVolumeBinding(p,rig.sourceVolume);
    if(p.id.startsWith('arm'))assert.equal(b.width,p.direction==='front'?1:1.18);
    else if(p.id.startsWith('leg')&&['left','right'].includes(p.direction))assert.equal(b.width,.86);
    else assert.equal(b.width,1);
    if(p.targetEnd&&b.axis){
      const [x,y,slope]=b.axis;
      for(const [px,py] of [p.pivot,p.targetEnd])assert.ok(Math.abs(x+b.width*(px-x)+(1-b.width)*slope*(py-y)-px)<1e-9);
    }
  }
});
test('source volume preserves both fixed arm attachments and every vertical coordinate',()=>{
  const p={id:'armLeft-front',pivot:[119,136.883721],targetEnd:[127,180.418605]};
  const b=sourceVolumeBinding(p,{arm:1.4}),[x,y,slope]=b.axis;
  for(const [px,py] of [p.pivot,p.targetEnd]){
    const result=x+b.width*(px-x)+(1-b.width)*slope*(py-y);
    assert.ok(Math.abs(result-px)<1e-10);
  }
  assert.match(b.transform,/matrix\(1\.4 0 [^ ]+ 1 0 0\)/);
});
test('no volume profile leaves existing character source bindings byte-compatible',()=>{
  for(const id of ['torso-front','skirt-back','armLeft-right','legRight-front','head','bag-front']){
    assert.deepEqual(sourceVolumeBinding({id},undefined),{width:1,transform:''});
  }
});
test('volume is restricted to costume and limb art, not heads or asymmetrical accessories',()=>{
  const profile={torso:1.34,skirt:1.28,arm:1.4,leg:1.32};
  for(const id of ['head-front','bag-front','neck-front','shadow-front'])assert.equal(sourceVolumeBinding({id},profile).transform,'');
  assert.throws(()=>sourceVolumeBinding({id:'torso-front',pivot:[96,172]},{torso:Infinity}));
  assert.throws(()=>sourceVolumeBinding({id:'torso-front',pivot:[96,172]},{torso:-1}));
});
test('guest07 source volume is explicit and all four directional torso bindings retain it',async()=>{
  const base=new URL('../character-assets/rigs/guest-07/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('body-registration.json',base)));
  const audit=JSON.parse(await readFile(new URL('generated/body-audit.json',base)));
  assert.deepEqual(rig.sourceVolume,{torso:1.34,skirt:1.28,arm:1.4,leg:1.32});
  for(const p of rig.parts.filter(p=>p.source)){
    const expected=sourceVolumeBinding(p,rig.sourceVolume);
    assert.deepEqual(audit.parts.find(a=>a.id===p.id).sourceVolume,expected);
  }
});
test('directional source width can shorten the side shoe without changing height or other directions',async()=>{
  const base=new URL('../character-assets/rigs/guest-07/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('body-registration.json',base)));
  const overrides=rig.parts.filter(p=>p.sourceWidth!==undefined);
  assert.deepEqual(overrides.map(p=>p.id),['legLeft-left','legRight-left','legLeft-right','legRight-right']);
  for(const p of overrides){
    const b=sourceVolumeBinding(p,rig.sourceVolume);
    assert.equal(b.width,1.06);assert.equal(b.axis[2],0);
    assert.equal(p.mirrored,false);
    assert.match(b.transform,/matrix\(1\.06 0 0 1 0 0\)/);
  }
  for(const p of rig.parts.filter(p=>p.id.startsWith('leg')&&['front','back'].includes(p.direction)))assert.equal(sourceVolumeBinding(p,rig.sourceVolume).width,1.32);
  assert.deepEqual(sourceVolumeBinding({id:'head-front',sourceWidth:1.06},rig.sourceVolume),{width:1,transform:''});
});
