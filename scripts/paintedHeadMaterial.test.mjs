import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {readPaintedHeadMaterial} from './lib/paintedHeadMaterial.mjs';
import {blendPaintedSourcePixels} from './lib/paintedSourceOverlay.mjs';
test('source blend pins the fused float32 boundary instead of host compiler arithmetic',()=>{
  const source=Buffer.from([5,5,5]),paint=Buffer.from([39,26,21,30]);
  assert.deepEqual([...blendPaintedSourcePixels(source,paint,3)],[9,7,6]);
  assert.deepEqual([...source],[5,5,5]);
});
test('source blending preserves cream RGB without paint and retains every original matte alpha',()=>{
  for(const alpha of [0,1,127,128,254,255]){
    const source=Buffer.from([230,225,215,alpha]);
    assert.deepEqual([...blendPaintedSourcePixels(source,Buffer.from([39,26,21,0]),4)],alpha?[230,225,215,alpha]:[0,0,0,0]);
    assert.equal(blendPaintedSourcePixels(source,Buffer.from([39,26,21,30]),4)[3],alpha);
  }
});
test('source blending rejects incompatible material buffers',()=>{
  assert.throws(()=>blendPaintedSourcePixels(Buffer.from([1,2,3]),Buffer.alloc(8),3));
  assert.throws(()=>blendPaintedSourcePixels(Buffer.alloc(2),Buffer.alloc(4),2));
});
test('guest07 right rear-lock material preserves face, crown, ear, lower curls and alpha',async()=>{
  const base=new URL('../character-assets/rigs/guest-07/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('head-registration.json',base)));
  assert.deepEqual(rig.heads.filter(p=>p.sourceOverlays?.length).map(p=>p.direction),['right']);
  assert.equal(rig.heads.find(p=>p.direction==='left').sourceOverlays,undefined,'Ineffective left forelock trial must remain unregistered');
  const p=rig.heads.find(p=>p.direction==='right');
  assert.deepEqual(p.pivot,[660,885]);assert.equal(p.chinY-p.crownY,850);assert.equal(p.mirrored,false);
  const original=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const output=await sharp(await readFile(new URL('generated/head-right.png',base))).ensureAlpha().raw().toBuffer();
  const overlay=await sharp(await readFile(new URL(p.sourceOverlays[0],base))).ensureAlpha().raw().toBuffer();
  let changed=0;
  for(let i=0;i<alpha.length;i++){
    assert.equal(output[i*4+3],alpha[i]);
    const x=i%original.info.width,y=Math.floor(i/original.info.width);
    if(y<200||y>=570||x>=310)assert.equal(overlay[i*4+3],0);
    if(alpha[i]===255){
      const same=output.subarray(i*4,i*4+3).equals(original.data.subarray(i*3,i*3+3));
      if(overlay[i*4+3]===0)assert.ok(same);else if(!same)changed++;
    }
  }
  assert.ok(changed>0);
});
test('guest01 rear upper-lock material preserves crown, center, lower hair and alpha',async()=>{
  const base=new URL('../character-assets/rigs/guest-01/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('head-registration.json',base)));
  assert.deepEqual(rig.heads.filter(p=>p.sourceOverlays?.length).map(p=>p.direction),['back']);
  const p=rig.heads.find(p=>p.direction==='back');
  assert.deepEqual(p.pivot,[615,802]);assert.equal(p.chinY-p.crownY,730);assert.equal(p.mirrored,false);
  const original=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const output=await sharp(await readFile(new URL('generated/head-back.png',base))).ensureAlpha().raw().toBuffer();
  const overlay=await sharp(await readFile(new URL(p.sourceOverlays[0],base))).ensureAlpha().raw().toBuffer();
  let changed=0;
  for(let i=0;i<alpha.length;i++){
    assert.equal(output[i*4+3],alpha[i]);
    const x=i%original.info.width,y=Math.floor(i/original.info.width);
    if(y<150||y>=600||(x>=410&&x<820))assert.equal(overlay[i*4+3],0);
    if(alpha[i]===255){
      const same=output.subarray(i*4,i*4+3).equals(original.data.subarray(i*3,i*3+3));
      if(overlay[i*4+3]===0)assert.ok(same);else if(!same)changed++;
    }
  }
  assert.ok(changed>0);
});
test('guest02 ineffective rear hair material remains unregistered',async()=>{
  const base=new URL('../character-assets/rigs/guest-02/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('head-registration.json',base)));
  const p=rig.heads.find(p=>p.direction==='back');
  assert.deepEqual(p.pivot,[620,1095]);assert.equal(p.chinY-p.crownY,971);assert.equal(p.mirrored,false);
  assert.equal(p.sourceOverlays,undefined);
  const original=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const output=await sharp(await readFile(new URL('generated/head-back.png',base))).ensureAlpha().raw().toBuffer();
  for(let i=0;i<alpha.length;i++){
    assert.equal(output[i*4+3],alpha[i]);
    if(alpha[i]===255){
      assert.deepEqual(output.subarray(i*4,i*4+3),original.data.subarray(i*3,i*3+3));
    }
  }
});
test('guest02 left hair material preserves face, crown, ear, lower bun and original alpha',async()=>{
  const base=new URL('../character-assets/rigs/guest-02/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('head-registration.json',base)));
  assert.deepEqual(rig.heads.filter(p=>p.sourceOverlays?.length).map(p=>p.direction),['left']);
  const p=rig.heads.find(p=>p.direction==='left');
  assert.deepEqual(p.pivot,[640,1055]);assert.equal(p.chinY-p.crownY,934);assert.equal(p.mirrored,false);
  const original=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const output=await sharp(await readFile(new URL('generated/head-left.png',base))).ensureAlpha().raw().toBuffer();
  const overlay=await sharp(await readFile(new URL(p.sourceOverlays[0],base))).ensureAlpha().raw().toBuffer();
  let changed=0;
  for(let i=0;i<alpha.length;i++){
    assert.equal(output[i*4+3],alpha[i]);
    const x=i%original.info.width,y=Math.floor(i/original.info.width);
    if(y<220||y>=710||(x>=280&&x<940))assert.equal(overlay[i*4+3],0,'Face, crown, ear and lower bun remain unpainted');
    if(alpha[i]===255){
      const same=output.subarray(i*4,i*4+3).equals(original.data.subarray(i*3,i*3+3));
      if(overlay[i*4+3]===0)assert.ok(same);else if(!same)changed++;
    }
  }
  assert.ok(changed>0);
});
test('unregistered head material is byte-identical and private overlays preserve untouched source colors',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'storybook-head-material-'));
  try{
    const source=await sharp({create:{width:20,height:30,channels:3,background:'#a08060'}}).png().toBuffer();
    await writeFile(path.join(dir,'source.png'),source);
    await writeFile(path.join(dir,'shade.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="30"><rect width="2" height="30" fill="#382418"/></svg>');
    const plain=await readPaintedHeadMaterial(dir,{source:'source.png'});
    assert.deepEqual(plain.data,await sharp(source).removeAlpha().raw().toBuffer());
    assert.deepEqual(plain.overlays,[]);
    const painted=await readPaintedHeadMaterial(dir,{source:'source.png',sourceOverlays:['shade.svg']});
    assert.equal(painted.overlays.length,1);assert.match(painted.overlays[0].sha256,/^[a-f0-9]{64}$/);
    assert.deepEqual(painted.info,plain.info);
    for(let i=0;i<600;i++){
      if(i%20>=2)assert.deepEqual(painted.data.subarray(i*3,i*3+3),plain.data.subarray(i*3,i*3+3));
      else assert.notDeepEqual(painted.data.subarray(i*3,i*3+3),plain.data.subarray(i*3,i*3+3));
    }
    assert.deepEqual(await readFile(path.join(dir,'source.png')),source);
    assert.deepEqual((await readPaintedHeadMaterial(dir,{source:'source.png'})).data,plain.data,'No implicit cross-character application');
    await assert.rejects(readPaintedHeadMaterial(dir,{source:'source.png',sourceOverlays:['source.png']}),/editable SVG/);
    await writeFile(path.join(dir,'wrong.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"/>');
    await assert.rejects(readPaintedHeadMaterial(dir,{source:'source.png',sourceOverlays:['wrong.svg']}),/original source coordinates/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('guest06 upper back hair material preserves silhouette, crown, ears, earrings and central parting',async()=>{
  const base=new URL('../character-assets/rigs/guest-06/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('head-registration.json',base)));
  const parts=rig.heads.filter(p=>p.direction==='back'&&p.sourceOverlays?.length);
  assert.deepEqual(parts.map(p=>p.direction),['back']);
  const p=parts[0];assert.deepEqual(p.pivot,[650,950]);assert.equal(p.chinY-p.crownY,910);assert.equal(p.mirrored,false);
  const original=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const output=await sharp(await readFile(new URL('generated/head-back.png',base))).ensureAlpha().raw().toBuffer();
  const overlay=await sharp(await readFile(new URL(p.sourceOverlays[0],base))).ensureAlpha().raw().toBuffer();
  let changed=0;
  for(let i=0;i<alpha.length;i++){
    assert.equal(output[i*4+3],alpha[i]);
    const x=i%original.info.width,y=Math.floor(i/original.info.width);
    if(y<100||y>=600||(x>=520&&x<=780))assert.equal(overlay[i*4+3],0,'Crown, lower locks, ears and center must be untouched');
    if(alpha[i]===255){
      const same=output.subarray(i*4,i*4+3).equals(original.data.subarray(i*3,i*3+3));
      if(overlay[i*4+3]===0)assert.ok(same);else if(!same)changed++;
    }
  }
  assert.ok(changed>0,'Material must affect source art, not only transparent background');
});
test('guest06 left hair material preserves forehead, face, crown, ear and lower locks',async()=>{
  const base=new URL('../character-assets/rigs/guest-06/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('head-registration.json',base)));
  assert.deepEqual(rig.heads.filter(p=>p.sourceOverlays?.length).map(p=>p.direction),['left','back']);
  const p=rig.heads.find(p=>p.direction==='left');assert.deepEqual(p.pivot,[650,910]);assert.equal(p.chinY-p.crownY,860);assert.equal(p.mirrored,false);
  const original=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const output=await sharp(await readFile(new URL('generated/head-left.png',base))).ensureAlpha().raw().toBuffer();
  const overlay=await sharp(await readFile(new URL(p.sourceOverlays[0],base))).ensureAlpha().raw().toBuffer();
  let changed=0;
  for(let i=0;i<alpha.length;i++){
    assert.equal(output[i*4+3],alpha[i]);
    const x=i%original.info.width,y=Math.floor(i/original.info.width);
    if(y<140||y>=590||(x>=280&&x<900))assert.equal(overlay[i*4+3],0,'Facial and central hair artwork must remain unpainted');
    if(alpha[i]===255){
      const same=output.subarray(i*4,i*4+3).equals(original.data.subarray(i*3,i*3+3));
      if(overlay[i*4+3]===0)assert.ok(same);else if(!same)changed++;
    }
  }
  assert.ok(changed>0);
});
test('guest08 right outer-lock material preserves face, ear, crown, lower curls and alpha',async()=>{
  const base=new URL('../character-assets/rigs/guest-08/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('head-registration.json',base)));
  assert.deepEqual(rig.heads.filter(p=>p.sourceOverlays?.length).map(p=>p.direction),['right']);
  const p=rig.heads.find(p=>p.direction==='right');assert.deepEqual(p.pivot,[620,875]);assert.equal(p.chinY-p.crownY,820);assert.equal(p.mirrored,false);
  const original=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const output=await sharp(await readFile(new URL('generated/head-right.png',base))).ensureAlpha().raw().toBuffer();
  const overlay=await sharp(await readFile(new URL(p.sourceOverlays[0],base))).ensureAlpha().raw().toBuffer();
  let changed=0;
  for(let i=0;i<alpha.length;i++){
    assert.equal(output[i*4+3],alpha[i]);
    const x=i%original.info.width,y=Math.floor(i/original.info.width);
    if(y<160||y>=580||x>=400)assert.equal(overlay[i*4+3],0);
    if(alpha[i]===255){
      const same=output.subarray(i*4,i*4+3).equals(original.data.subarray(i*3,i*3+3));
      if(overlay[i*4+3]===0)assert.ok(same);else if(!same)changed++;
    }
  }
  assert.ok(changed>0);
});
