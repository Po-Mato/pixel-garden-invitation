import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from './lib/deterministicSharp.mjs';
import {verifyCurrentCharacter,sha256} from './lib/currentCharacterSources.mjs';
import {verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'character-assets/generated/full-review-v1');
const read=f=>fs.readFile(path.resolve(root,f));
const catalog=JSON.parse(await read('character-assets/rigs/guest-cutout-catalog-v1.json'));
const dirs=['front','left','right','back'],characters=[],contacts=[],game=[],allFrames=[];
await fs.mkdir(out,{recursive:true});
for(const[cindex,c]of catalog.characters.entries()){
 let sheet,sources=[];
 if(['guest-02','guest-12'].includes(c.characterId)){
  const tiles=[];
  for(const[row,dir]of dirs.entries()){
   const folder=dir==='front'?(c.characterId==='guest-02'?'character-assets/rigs/hanbok-neck-art-v10/front-rig/guest-02':`character-assets/rigs/hanbok-straight-sleeves-v7/front-rig/${c.characterId}`):dir==='back'?`character-assets/rigs/hanbok-directions-v8/back-rig/${c.characterId}`:`character-assets/rigs/hanbok-directions-v8/side-rig/${c.characterId}/${dir}`;
   await verifyPaintedRenderReceipt(root,path.join(root,folder,'receipt.json'));
   for(let col=0;col<4;col++){const file=`${folder}/${dir}-${col+1}.png`,bytes=await read(file);sources.push({file,sha256:sha256(bytes)});tiles.push({input:bytes,left:col*192,top:row*288});}
  }
  sheet=await sharp({create:{width:768,height:1152,channels:4,background:'#00000000'}}).composite(tiles).png().toBuffer();
 }else{const v=await verifyCurrentCharacter(root,c.characterId);sheet=await read(v.source);sources=[{file:v.source,sha256:sha256(sheet),receipt:v.receipt}];}
 const frames=[],checks=[];
 for(const[row,dir]of dirs.entries()){
  const r=[];
  for(let col=0;col<4;col++){const png=await sharp(sheet).extract({left:col*192,top:row*288,width:192,height:288}).png().toBuffer(),raw=await sharp(png).ensureAlpha().raw().toBuffer();r.push(raw);frames.push(png);
   let minY=288,maxY=-1,minX=192,maxX=-1;for(let y=0;y<288;y++)for(let x=0;x<192;x++)if(raw[(y*192+x)*4+3]>=128){minY=Math.min(y,minY);maxY=Math.max(y,maxY);minX=Math.min(x,minX);maxX=Math.max(x,maxX);}
   assert.equal(minY,54);assert.equal(maxY,269);assert.ok(minX>0&&maxX<191);checks.push({dir,frame:col+1,top:minY,bottom:maxY,center:(minX+maxX)/2});
   allFrames.push({input:await sharp(png).resize(48,72).png().toBuffer(),left:((cindex%4)*4+col)*48,top:(Math.floor(cindex/4)*4+row)*72});
  }
  assert.deepEqual(r[1],r[3]);assert.notDeepEqual(r[0],r[2]);const group=checks.filter(x=>x.dir===dir);assert.ok((Math.max(...group.map(x=>x.center))-Math.min(...group.map(x=>x.center)))/4<=1);
  contacts.push({input:await sharp(frames[row*4+1]).resize(96,144).png().toBuffer(),left:cindex*96,top:row*144});game.push({input:await sharp(frames[row*4+1]).resize(48,72).png().toBuffer(),left:cindex*48,top:row*72});
 }
 const neutral=frames[1],idle=await sharp({create:{width:384,height:288,channels:4,background:'#00000000'}}).composite([{input:neutral,left:0,top:0},{input:neutral,left:192,top:0}]).png().toBuffer();
 const folder=path.join(out,c.presetId);await fs.mkdir(folder,{recursive:true});const outputs=[];
 for(const[k,b]of [['walk-hd',sheet],['walk-runtime',await sharp(sheet).resize(384,576).png().toBuffer()],['idle-hd',idle],['idle-runtime',await sharp(idle).resize(192,144).png().toBuffer()],['portrait',neutral]]){const file=`${c.presetId}__${k}.png`,m=await sharp(b).metadata();await fs.writeFile(path.join(folder,file),b);outputs.push({file,sha256:sha256(b),width:m.width,height:m.height});}
 characters.push({characterId:c.characterId,presetId:c.presetId,label:c.label,sources,checks,outputs});
}
const manifest={version:1,pipeline:'full-review-v1',localReviewOnly:true,productionReady:false,geometry:{head:72,body:144,total:216,frame:[192,288]},characters};
await fs.writeFile(path.join(out,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const[name,width,height,items]of [['all-directions-96',1152,576,contacts],['all-directions-48',576,288,game],['all-walk-frames-48',768,864,allFrames]])await sharp({create:{width,height,channels:4,background:'#e8e6dc'}}).composite(items).png().toFile(path.join(out,name+'.png'));
console.log(JSON.stringify({out,characters:12,directions:48,frames:192,verified:true}));
