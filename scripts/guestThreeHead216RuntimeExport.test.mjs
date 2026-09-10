import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=new URL('../',import.meta.url),base=new URL('character-assets/generated/three-head-216-v1/',root);
const manifest=JSON.parse(await readFile(new URL('build-manifest.json',base)));
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(manifest.stagingOnly,true);assert.equal(manifest.publicAssetsModified,false);assert.equal(manifest.characters.length,12);
for(const c of manifest.characters)test(`${c.characterId} staged runtime is a whole-frame reduction of the original rig render`,async()=>{
 const review=new URL(`character-assets/rigs/${c.characterId}/three-head-216-v1/`,root),dir=new URL(c.presetId+'/',base);
 const bytes={};for(const output of c.outputs){bytes[output.file]=await readFile(new URL(output.file,dir));assert.equal(hash(bytes[output.file]),output.sha256);}
 const high=bytes[`${c.presetId}__walk-hd.png`],runtime=bytes[`${c.presetId}__walk-runtime.png`];
 assert.equal(hash(high),hash(await readFile(new URL('review/walk-sheet.png',review))));assert.equal(hash(high),c.sourceSheetSha256);
 for(const[name,size]of [['walk-hd',[768,1152]],['idle-hd',[384,288]],['walk-runtime',[384,576]],['idle-runtime',[192,144]]]){const meta=await sharp(bytes[`${c.presetId}__${name}.png`]).metadata();assert.deepEqual([meta.width,meta.height],size);assert.equal(meta.hasAlpha,true);}
 for(const[row,d]of ['front','left','right','back'].entries())for(let i=1;i<=4;i++){
  const original=await readFile(new URL(`generated/${d}/frame-${i}.png`,review));
  const expected=await sharp(original).resize(96,144,{kernel:'nearest'}).raw().toBuffer();
  const actual=await sharp(runtime).extract({left:(i-1)*96,top:row*144,width:96,height:144}).raw().toBuffer();assert.deepEqual(actual,expected);
 }
 for(const[kind,w,h]of [['hd',192,288],['runtime',96,144]]){
  const idle=bytes[`${c.presetId}__idle-${kind}.png`];
  const a=await sharp(idle).extract({left:0,top:0,width:w,height:h}).raw().toBuffer(),b=await sharp(idle).extract({left:w,top:0,width:w,height:h}).raw().toBuffer();assert.deepEqual(a,b);
 }
});
