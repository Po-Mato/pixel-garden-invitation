import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {readPaintedHeadMaterial} from './lib/paintedHeadMaterial.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-01/storybook-source-v1');
const out=path.join(base,'review/balanced-shading-v3');
const approved=path.join(base,'review/balanced-arms-four-direction-v2');
const json=async p=>JSON.parse(await fs.readFile(p));
const audit=await json(path.join(out,'audit.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('shading uses tracked native vector originals, not final frame patches',async()=>{
 assert.equal(audit.sourceOverlayAudit.length,12);
 for(const a of audit.sourceOverlayAudit){
  assert.equal(a.blend,'atop');assert.equal(a.alphaPreserved,true);
  const b=await fs.readFile(path.resolve(base,a.file));assert.equal(hash(b),a.sha256);
  assert.doesNotMatch(b.toString(),/<(?:image|foreignObject|script)\b|(?:href|xlink:href)\s*=/i);
  assert.equal(hash(await fs.readFile(path.resolve(base,a.source))),a.sourceSha256);
  assert.equal(hash(await fs.readFile(path.resolve(base,a.matte))),a.matteSha256);
 }
});
test('all sixteen silhouettes, faces and arms exactly retain approved shape and art',async()=>{
 for(const d of audit.directions)for(let i=1;i<=4;i++){
  const name=`${d.direction}-walk-${i}.png`,b=await fs.readFile(path.join(out,name));
  const m=await sharp(b).metadata();assert.deepEqual([m.width,m.height],[192,288]);assert.equal(hash(b),d.frames[i-1]);
  assert.deepEqual(await sharp(b).extractChannel(3).raw().toBuffer(),await sharp(path.join(approved,name)).extractChannel(3).raw().toBuffer());
  const protectedRegions=d.direction==='front'?[{left:0,top:0,width:192,height:60},{left:75,top:90,width:43,height:36},{left:0,top:171,width:56,height:117},{left:138,top:171,width:54,height:117}]:[{left:0,top:0,width:192,height:170}];
  for(const region of protectedRegions)assert.deepEqual(await sharp(b).extract(region).raw().toBuffer(),await sharp(path.join(approved,name)).extract(region).raw().toBuffer());
 }
});
test('front hair shading has zero overlap with original face and keeps crown and unpainted RGB',async()=>{
 const rig=await json(path.join(base,'head-registration.json')),p=rig.heads.find(p=>p.direction==='front');
 const config=await json(path.join(base,'head-layers.json')),face=config.directions.front.layers.find(l=>l.id==='face');
 const a=audit.headSourceAudit.find(a=>a.direction==='front');assert.equal(a.overlays.length,1);
 const {data:original,info}=await readPaintedHeadMaterial(base,p);
 const {data:painted}=await readPaintedHeadMaterial(base,{...p,sourceOverlays:a.overlays.map(o=>o.file)});
 const overlay=await fs.readFile(path.join(base,a.overlays[0].file));assert.equal(hash(overlay),a.overlays[0].sha256);
 const alpha=await sharp(overlay).ensureAlpha().extractChannel(3).raw().toBuffer();
 const faceMask=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}"><path fill="white" d="${face.path}"/></svg>`)).ensureAlpha().extractChannel(3).raw().toBuffer();
 let changed=0;for(let i=0;i<alpha.length;i++){
  if(faceMask[i]||i<info.width*200)assert.equal(alpha[i],0,'Face and crown must remain unpainted');
  const same=original.subarray(i*3,i*3+3).equals(painted.subarray(i*3,i*3+3));
  if(!alpha[i])assert.ok(same);else if(!same)changed++;
 }assert.ok(changed>0);
});
test('cream garment interior and untouched skin remain original RGB; alpha is exact',async()=>{
 const rig=await json(path.join(base,'body-registration.json'));
 for(const p of rig.parts.filter(p=>audit.sourceOverlayAudit.some(a=>a.part===p.id))){
  const result=await sharp(path.join(out,`${p.id}-source.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const original=await sharp(path.resolve(base,p.source)).removeAlpha().raw().toBuffer();
  const alpha=await sharp(path.resolve(base,p.matte)).ensureAlpha().extractChannel(3).raw().toBuffer();
  const overlayFiles=audit.sourceOverlayAudit.filter(a=>a.part===p.id).map(a=>a.file);
  const layers=await Promise.all(overlayFiles.map(f=>sharp(path.resolve(base,f)).ensureAlpha().extractChannel(3).raw().toBuffer()));
  let interior=0,changed=0;
  for(let i=0;i<alpha.length;i++){
   assert.equal(result.data[i*4+3],alpha[i]);
   if(alpha[i]!==255)continue;
   const same=result.data.subarray(i*4,i*4+3).equals(original.subarray(i*3,i*3+3));
   if(layers.every(l=>l[i]===0)){assert.ok(same,`${p.id}: unpainted RGB changed`);interior++;}
   if(!same)changed++;
  }
  assert.ok(interior>1000);assert.ok(changed>0);
 }
});
test('all source joints connect and neutral poses remain identical',async()=>{
 assert.equal(audit.connections.length,112);assert.ok(audit.connections.every(c=>c.connected&&c.pixelsA>0&&c.pixelsB>0));
 for(const d of audit.directions){assert.deepEqual(await fs.readFile(path.join(out,`${d.direction}-walk-2.png`)),await fs.readFile(path.join(out,`${d.direction}-walk-4.png`)));assert.notEqual(d.frames[0],d.frames[2]);}
 for(const [f,h] of audit.protectedHashes)assert.equal(hash(await fs.readFile(path.join(base,f))),h);
});
test('release decision cannot hide map contrast failures or weaken thresholds',async()=>{
 const e=await json(path.join(out,'map-evidence.json')),g=await json(path.join(out,'release-gate.json'));
 assert.deepEqual(e.thresholds,(await json(path.join(root,'scripts/visual-baselines/map-tone-contract.json'))).thresholds);
 assert.equal(e.sourceHashes.find(s=>s.id==='guest01-approved').sha256,hash(await fs.readFile(path.join(out,'walk-runtime.png'))));
 const rows=e.rows.filter(r=>r.id==='guest01-approved');assert.equal(rows.length,160);
 const failures=rows.filter(r=>Number(r.edgeContrast.toFixed(3))<e.thresholds.minCharacterEdgeContrast||Object.values(r.displayEdgeContrasts).some(v=>Number(v.toFixed(3))<e.thresholds.minDisplayCharacterEdgeContrast));
 assert.equal(g.releaseEligible,failures.length===0);
});
test('actual mobile game uses exact shading assets and all four movement frames',async()=>{
 for(const zone of ['', 'neighborhood-']){
  const e=await json(path.join(out,`client-game-${zone}evidence.json`));assert.equal(e.captureComplete,true);assert.deepEqual(e.viewport,[390,844]);assert.equal(e.rows.length,4);
  for(const r of e.rows){assert.equal(r.sha256,hash(await fs.readFile(path.join(out,'walk-runtime.png'))));assert.equal(new Set(r.frames).size,4);assert.deepEqual(r.moving.size,['48px','72px']);assert.equal(r.stopped.moving,'false');assert.ok(['up','left'].includes(r.direction)?r.delta<0:r.delta>0);}
 }
});
test('mobile selection switches twelve presets and plays the current candidate in every direction',async()=>{
 const e=await json(path.join(out,'client-selection-evidence.json'));assert.equal(e.captureComplete,true);assert.equal(e.switched.length,12);assert.equal(new Set(e.switched.map(s=>s.preset)).size,12);
 assert.equal(e.rows.length,4);for(const r of e.rows){assert.equal(r.sha256,hash(await fs.readFile(path.join(out,'walk.png'))));assert.equal(new Set(r.frames).size,4);assert.equal(r.serviceWorkerControlled,false);}
 assert.deepEqual(e.stop,{moving:false,frame:'1'});
});
