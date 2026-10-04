import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from './deterministicSharp.mjs';

export const coupleStyleDirectory = 'character-assets/generated/couple-style-v1';
export const coupleStyleApprovalFile = 'character-assets/rigs/couple-style-v1/production-review.json';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const directions = ['front', 'left', 'right', 'back'];
function alphaBounds(raw) {
  let left=192,right=-1,top=288,bottom=-1;
  for(let y=0;y<288;y++)for(let x=0;x<192;x++)if(raw[(y*192+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  assert.equal(top,54,'Frame head top must be 54');assert.equal(bottom,269,'Frame foot baseline must be 270');
  assert.ok(left>0&&right<191,'Frame must not clip the canvas');
  return {center:(left+right)/2};
}

export async function verifyCoupleStyleProductionSources(root) {
  const canonicalRoot = await fs.realpath(root);
  const within = file => {const relative=path.relative(canonicalRoot,file);return relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
  const read = async file => {
    assert.equal(typeof file,'string','Dependency path must be a string');
    assert.ok(file&&!file.includes('\0')&&!path.isAbsolute(file)&&!file.split(/[\\/]/).includes('..'),'Dependency must stay inside project');
    const resolved=path.resolve(canonicalRoot,file);assert.ok(within(resolved),'Dependency must stay inside project');
    const real=await fs.realpath(resolved);assert.ok(within(real),'Symlink dependency must stay inside project');
    return fs.readFile(real);
  };
  const checked = async entry => {
    assert.ok(entry&&typeof entry==='object');assert.match(entry.sha256,/^[a-f0-9]{64}$/);
    const bytes=await read(entry.file);assert.equal(hash(bytes),entry.sha256,'Changed release dependency: '+entry.file);return bytes;
  };
  const manifestBytes=await read(`${coupleStyleDirectory}/build-manifest.json`),manifest=JSON.parse(manifestBytes);
  const approval=JSON.parse(await read(coupleStyleApprovalFile));
  assert.equal(approval.version,1);assert.equal(approval.pipeline,'couple-style-v1');
  assert.equal(approval.authorization,'user-requested-production-deployment');
  assert.equal(approval.manifestSha256,hash(manifestBytes),'Review must bind the exact package');
  assert.deepEqual(approval.visualInspection,{passed:true,characters:12,directions:48,frames:192});
  for(const key of ['sourceIntegrity','evidence']) {
    assert.ok(Array.isArray(approval[key])&&approval[key].length>0,'Missing '+key);
    assert.equal(new Set(approval[key].map(e=>e.file)).size,approval[key].length,'Duplicate '+key+' path');
    for(const entry of approval[key])await checked(entry);
  }
  const sourceClosure=new Set(approval.sourceIntegrity.map(e=>e.file));
  assert.equal(manifest.version,1);assert.equal(manifest.localOnly,false,'Local-only package cannot be deployed');
  assert.equal(manifest.productionReady,true,'Package must be production-ready');
  assert.equal(manifest.pipeline,'couple-style-v1');
  assert.deepEqual(manifest.geometry,{frame:[192,288],sourceTop:54,sourceBottom:270,sourceHeight:216,worldFrame:[48,72],worldContentScale:7/6,worldVisibleHeight:63});
  const catalog=JSON.parse(await read('character-assets/rigs/guest-cutout-catalog-v1.json'));
  assert.equal(manifest.characters.length,12);
  const identity=list=>list.map(c=>[c.characterId,c.presetId]).sort((a,b)=>a[0].localeCompare(b[0]));
  assert.deepEqual(identity(manifest.characters),identity(catalog.characters),'Package must match the complete guest catalog');
  assert.equal(new Set(manifest.characters.map(c=>c.characterId)).size,12);
  assert.equal(new Set(manifest.characters.map(c=>c.presetId)).size,12);
  for(const c of manifest.characters) {
    assert.match(c.characterId,/^guest-(0[1-9]|1[0-2])$/);assert.match(c.presetId,/^[a-z0-9-]+$/);
    assert.equal(c.template,catalog.characters.find(x=>x.characterId===c.characterId).template);
    const expectedSources=directions.map(d=>`character-assets/rigs/couple-style-v1/neutral/${c.characterId}/${d}.png`);
    assert.deepEqual(c.sources.map(s=>s.file).sort(),[...expectedSources].sort(),'Exactly four direction source files required');
    const neutral=[];
    for(const file of expectedSources) {
      assert.ok(sourceClosure.has(file),'Neutral missing from source-integrity closure: '+file);
      const bytes=await checked(c.sources.find(s=>s.file===file)),meta=await sharp(bytes).metadata();
      assert.deepEqual([meta.width,meta.height],[192,288]);assert.ok(meta.hasAlpha,'Neutral alpha is required');
      const raw=await sharp(bytes).ensureAlpha().raw().toBuffer();alphaBounds(raw);neutral.push(raw);
    }
    const sizes={
      [`${c.presetId}__walk.png`]:[384,576], [`${c.presetId}__idle.png`]:[192,144],
      [`preview/${c.presetId}__walk.png`]:[768,1152], [`preview/${c.presetId}__idle.png`]:[384,288],
      [`portraits/${c.presetId}.png`]:[192,288]
    };
    assert.deepEqual(c.outputs.map(o=>o.file).sort(),Object.keys(sizes).sort(),'Exactly five output assets required');
    const outputs=new Map();
    for(const [file,size]of Object.entries(sizes)) {
      const entry=c.outputs.find(o=>o.file===file),bytes=await checked({...entry,file:`${coupleStyleDirectory}/${file}`});
      const meta=await sharp(bytes).metadata();assert.deepEqual([meta.width,meta.height],size,'Wrong output geometry: '+file);
      assert.ok(meta.hasAlpha,'Output alpha is required: '+file);outputs.set(file,bytes);
    }
    const hd=outputs.get(`preview/${c.presetId}__walk.png`);
    for(let row=0;row<4;row++) {
      const frames=[],centers=[],sourceColors=new Set();
      for(let i=0;i<neutral[row].length;i+=4)sourceColors.add(neutral[row].readUInt32LE(i));
      for(let column=0;column<4;column++) {
        const raw=await sharp(hd).extract({left:column*192,top:row*288,width:192,height:288}).ensureAlpha().raw().toBuffer();
        assert.ok(raw.subarray(0,145*192*4).equals(neutral[row].subarray(0,145*192*4)),'Head/neck/shoulder pixels changed');
        const b=alphaBounds(raw);centers.push(b.center);
        for(let i=0;i<raw.length;i+=4)assert.ok(sourceColors.has(raw.readUInt32LE(i)),'Walk contains pixels absent from neutral');
        frames.push(raw);
      }
      assert.ok(frames[1].equals(neutral[row])&&frames[3].equals(neutral[row]),'Neutral phases must exactly match their source');
      assert.ok(!frames[0].equals(frames[2]),'Opposite walking phases must differ');
      assert.ok(Math.max(...centers)-Math.min(...centers)<=4,'Center drift exceeds one world pixel');
    }
    const idle=outputs.get(`preview/${c.presetId}__idle.png`);
    for(let col=0;col<2;col++)assert.ok((await sharp(idle).extract({left:col*192,top:0,width:192,height:288}).ensureAlpha().raw().toBuffer()).equals(neutral[0]),'Idle must match front neutral');
    assert.ok((await sharp(outputs.get(`portraits/${c.presetId}.png`)).ensureAlpha().raw().toBuffer()).equals(neutral[0]),'Portrait must match front neutral');
    for(const [name,source,width,height]of [['walk',hd,384,576],['idle',idle,192,144]]) {
      const expected=await sharp(source).resize(width,height,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
      const actual=await sharp(outputs.get(`${c.presetId}__${name}.png`)).ensureAlpha().raw().toBuffer();
      assert.ok(actual.equals(expected),'Runtime must be the exact reviewed nearest export: '+name);
    }
  }
  return manifest;
}
