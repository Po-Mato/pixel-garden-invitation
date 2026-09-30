import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
export const fullReviewDirectory='character-assets/generated/full-review-v1';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function verifyFullReviewProductionSources(root){
 const safe=file=>{assert.equal(typeof file,'string');const target=path.resolve(root,file),relative=path.relative(root,target);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Dependency must stay inside project');return target;};
 const read=file=>fs.readFile(safe(file));
 const check=async entry=>{assert.match(entry.sha256,/^[a-f0-9]{64}$/);const bytes=await read(entry.file);assert.equal(hash(bytes),entry.sha256,'Changed release dependency: '+entry.file);return bytes;};
 const manifestBytes=await read(`${fullReviewDirectory}/build-manifest.json`),manifest=JSON.parse(manifestBytes);
 const approval=JSON.parse(await read(`${fullReviewDirectory}/production-review.json`));
 assert.equal(approval.version,1);assert.equal(approval.pipeline,'full-review-v1');assert.equal(approval.authorization,'user-requested-production-deployment');
 assert.equal(approval.manifestSha256,hash(manifestBytes),'Review must bind the exact package');
 assert.deepEqual(approval.visualInspection,{passed:true,characters:12,directions:48,frames:192});
 for(const key of ['evidence','sourceIntegrity']){assert.ok(Array.isArray(approval[key])&&approval[key].length>0,'Missing '+key);for(const entry of approval[key])await check(entry);}
 assert.equal(manifest.version,1);assert.equal(manifest.pipeline,'full-review-v1');
 assert.deepEqual(manifest.geometry,{head:72,body:144,total:216,frame:[192,288]});
 const catalog=JSON.parse(await read('character-assets/rigs/guest-cutout-catalog-v1.json'));
 assert.equal(manifest.characters.length,12);assert.deepEqual(manifest.characters.map(c=>[c.characterId,c.presetId]).sort(),catalog.characters.map(c=>[c.characterId,c.presetId]).sort());
 const sizes={'walk-hd':[768,1152],'walk-runtime':[384,576],'idle-hd':[384,288],'idle-runtime':[192,144],portrait:[192,288]};
 const bound=new Set(approval.sourceIntegrity.map(e=>e.file));
 for(const c of manifest.characters){
  assert.match(c.presetId,/^[a-z0-9-]+$/);assert.ok(c.sources.length>0);
  for(const source of c.sources){await check(source);if(source.receipt)assert.ok(bound.has(source.receipt),'Source receipt missing from integrity closure');}
  assert.equal(c.checks.length,16);assert.deepEqual(c.checks.map(f=>`${f.dir}/${f.frame}`).sort(),['front','left','right','back'].flatMap(d=>[1,2,3,4].map(n=>`${d}/${n}`)).sort());
  for(const f of c.checks){assert.equal(f.top,54);assert.equal(f.bottom,269);}
  assert.deepEqual(c.outputs.map(o=>o.file).sort(),Object.keys(sizes).map(k=>`${c.presetId}__${k}.png`).sort());
  for(const [kind,size]of Object.entries(sizes)){
   const output=c.outputs.find(o=>o.file===`${c.presetId}__${kind}.png`);
   const bytes=await check({...output,file:`${fullReviewDirectory}/${c.presetId}/${output.file}`});
   const metadata=await sharp(bytes).metadata();assert.deepEqual([metadata.width,metadata.height],size);assert.ok(metadata.hasAlpha);
  }
 }
 return manifest;
}
