import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from './lib/deterministicSharp.mjs';
import {verifyCoupleStyleProductionSources,coupleStyleDirectory,coupleStyleApprovalFile} from './lib/coupleStyleProductionSources.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const root=path.resolve(import.meta.dirname,'..');
async function fixture() {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'couple-proof-'));
  const write=async(file,bytes)=>{const p=path.join(dir,file);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,bytes);};
  const catalog=JSON.parse(await fs.readFile(path.join(root,'character-assets/rigs/guest-cutout-catalog-v1.json'),'utf8'));
  await write('character-assets/rigs/guest-cutout-catalog-v1.json',JSON.stringify(catalog));
  const raw=Buffer.alloc(192*288*4);
  for(let y=54;y<=269;y++)for(let x=75;x<=115;x++){const i=(y*192+x)*4;raw[i]=x;raw[i+1]=y%256;raw[i+2]=110;raw[i+3]=255;}
  const png=b=>sharp(b,{raw:{width:192,height:288,channels:4}}).png().toBuffer();
  const neutral=await png(raw),frames=[];
  for(const phase of [-1,0,1,0]){const b=Buffer.from(raw);if(phase)for(let y=145;y<288;y++)for(let x=0;x<192;x++){const i=(y*192+x)*4,source=(y*192+Math.max(0,Math.min(191,x-phase)))*4;raw.copy(b,i,source,source+4);}frames.push(await png(b));}
  const tiles=[];for(let row=0;row<4;row++)for(let col=0;col<4;col++)tiles.push({input:frames[col],left:col*192,top:row*288});
  const hd=await sharp({create:{width:768,height:1152,channels:4,background:'#00000000'}}).composite(tiles).png().toBuffer();
  const idle=await sharp({create:{width:384,height:288,channels:4,background:'#00000000'}}).composite([{input:neutral,left:0,top:0},{input:neutral,left:192,top:0}]).png().toBuffer();
  const walkSmall=await sharp(hd).resize(384,576,{kernel:'nearest'}).png().toBuffer(),idleSmall=await sharp(idle).resize(192,144,{kernel:'nearest'}).png().toBuffer();
  const sourceIntegrity=[],characters=[];
  for(const c of catalog.characters){const sources=[];for(const d of ['front','left','right','back']){const file=`character-assets/rigs/couple-style-v1/neutral/${c.characterId}/${d}.png`;await write(file,neutral);sources.push({file,sha256:hash(neutral)});sourceIntegrity.push(sources.at(-1));}const outputs=[];for(const[file,bytes]of [[`${c.presetId}__walk.png`,walkSmall],[`${c.presetId}__idle.png`,idleSmall],[`preview/${c.presetId}__walk.png`,hd],[`preview/${c.presetId}__idle.png`,idle],[`portraits/${c.presetId}.png`,neutral]]){await write(`${coupleStyleDirectory}/${file}`,bytes);outputs.push({file,sha256:hash(bytes)});}characters.push({...c,sources,outputs});}
  const manifest={version:1,pipeline:'couple-style-v1',localOnly:false,productionReady:true,geometry:{frame:[192,288],sourceTop:54,sourceBottom:270,sourceHeight:216,worldFrame:[48,72],worldContentScale:7/6,worldVisibleHeight:63},characters};
  await write('evidence.txt','synthetic test fixture only');
  const approval={version:1,pipeline:'couple-style-v1',authorization:'user-requested-production-deployment',manifestSha256:'',visualInspection:{passed:true,characters:12,directions:48,frames:192},sourceIntegrity,evidence:[{file:'evidence.txt',sha256:hash('synthetic test fixture only')}]};
  const save=async()=>{const bytes=Buffer.from(JSON.stringify(manifest));approval.manifestSha256=hash(bytes);await write(`${coupleStyleDirectory}/build-manifest.json`,bytes);await write(coupleStyleApprovalFile,JSON.stringify(approval));};
  await save();return{dir,write,manifest,approval,save};
}

test('production proof validates 48 neutral sources, 60 outputs and 192 pixel frames',async()=>{
  const f=await fixture();try{const result=await verifyCoupleStyleProductionSources(f.dir);assert.equal(result.characters.length,12);}finally{await fs.rm(f.dir,{recursive:true,force:true});}
});

test('approval binding, changed evidence, root traversal and symlink escapes are rejected',async()=>{
  const f=await fixture();const outside=await fs.mkdtemp(path.join(os.tmpdir(),'couple-proof-outside-'));
  try{
    f.approval.manifestSha256='0'.repeat(64);await f.write(coupleStyleApprovalFile,JSON.stringify(f.approval));
    await assert.rejects(verifyCoupleStyleProductionSources(f.dir),/exact package/);await f.save();
    await f.write('evidence.txt','changed');await assert.rejects(verifyCoupleStyleProductionSources(f.dir),/Changed release dependency/);await f.write('evidence.txt','synthetic test fixture only');
    const original=f.approval.evidence;f.approval.evidence=[{file:'../escape.txt',sha256:'0'.repeat(64)}];await f.save();await assert.rejects(verifyCoupleStyleProductionSources(f.dir),/inside project/);
    await fs.writeFile(path.join(outside,'secret.txt'),'outside');await fs.symlink(path.join(outside,'secret.txt'),path.join(f.dir,'escape-link'));
    f.approval.evidence=[{file:'escape-link',sha256:hash('outside')}];await f.save();await assert.rejects(verifyCoupleStyleProductionSources(f.dir),/Symlink dependency/);
    f.approval.evidence=original;await f.save();
  }finally{await fs.rm(f.dir,{recursive:true,force:true});await fs.rm(outside,{recursive:true,force:true});}
});

test('even rebound hashes cannot approve changed heads or missing direction sources',async()=>{
  const f=await fixture();try{
    const c=f.manifest.characters[0],entry=c.outputs.find(o=>o.file===`preview/${c.presetId}__walk.png`),file=`${coupleStyleDirectory}/${entry.file}`;
    const original=await fs.readFile(path.join(f.dir,file));const {data,info}=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});data[(54*768+75)*4]=0;
    const changed=await sharp(data,{raw:info}).png().toBuffer();await f.write(file,changed);entry.sha256=hash(changed);await f.save();await assert.rejects(verifyCoupleStyleProductionSources(f.dir),/Head\/neck\/shoulder/);
    await f.write(file,original);entry.sha256=hash(original);c.sources.pop();await f.save();await assert.rejects(verifyCoupleStyleProductionSources(f.dir),/four direction/);
  }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});

test('local-only packages cannot become production by an approval hash alone',async()=>{
  const f=await fixture();try{f.manifest.localOnly=true;await f.save();await assert.rejects(verifyCoupleStyleProductionSources(f.dir),/Local-only/);}finally{await fs.rm(f.dir,{recursive:true,force:true});}
});

test('actual approved couple-style production package passes all pixel contracts',async()=>{
  const manifest=await verifyCoupleStyleProductionSources(root);
  assert.equal(manifest.characters.reduce((n,c)=>n+c.sources.length,0),48);
  assert.equal(manifest.characters.reduce((n,c)=>n+c.outputs.length,0),60);
});
