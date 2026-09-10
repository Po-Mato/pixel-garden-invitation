import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const base=new URL('../character-assets/rigs/guest-03/three-head-216-v1/',import.meta.url);
const json=async u=>JSON.parse(await readFile(u));
const hash=b=>createHash('sha256').update(b).digest('hex');
for(let i=1;i<=12;i++)test(`guest-${i} directional head-width spread stays within the existing 10 percent gate`,async()=>{
 const id='guest-'+String(i).padStart(2,'0'),widths=[];
 for(const d of ['front','left','right','back']){
  const {data,info}=await sharp(await readFile(new URL(`../character-assets/rigs/${id}/three-head-216-v1/generated/${d}/frame-2.png`,import.meta.url))).raw().toBuffer({resolveWithObject:true});
  let left=192,right=-1;for(let y=0;y<126;y++)for(let x=0;x<192;x++)if(data[(y*192+x)*info.channels+3]>=96){left=Math.min(left,x);right=Math.max(right,x);}widths.push(right-left+1);
 }
 const spread=(Math.max(...widths)-Math.min(...widths))/(widths.reduce((a,b)=>a+b)/4);
 assert.ok(spread<=0.1,`${id} widths ${widths} spread ${spread}`);
});
// Current per-character actual game/selection proofs are verified in guestThreeHead216RuntimeEvidence.test.mjs.
// The earlier guest-03-only local-game-review.json remains historical evidence, not a current source-hash claim.
for(const id of Array.from({length:12},(_,i)=>'guest-'+String(i+1).padStart(2,'0')))test(`${id} 216 mobile evidence and whole-frame atlas are tied to current renders`,async()=>{
 const base=new URL(`../character-assets/rigs/${id}/three-head-216-v1/`,import.meta.url);
 const review=new URL('review/',base),m=await json(new URL('manifest.json',review)),e=await json(new URL('browser-review.json',review));
 assert.equal(e.runtimeIntegrated,false);assert.equal(m.runtimeEnabled,false);
 assert.deepEqual(e.viewport,[390,844]);assert.equal(e.horizontalOverflow,false);
 assert.deepEqual(e.displaySizes,[[192,288],[96,144],[48,72]]);
 assert.deepEqual([...new Set(e.observedFrames)].sort(),[1,2,3,4]);assert.deepEqual(e.stopBeforeAfter400ms,[2,2]);
 assert.deepEqual(e.frameSources,m.sources);assert.equal(e.screenshots.length,12);
 for(const s of e.screenshots){const b=await readFile(new URL(s.file,review));assert.equal(hash(b),s.sha256);const meta=await sharp(b).metadata();assert.deepEqual([meta.width,meta.height],[390,844]);}
 const sheet=await readFile(new URL('walk-sheet.png',review));assert.equal(hash(sheet),m.sheetSha256);assert.equal(m.sheetSha256,e.sheetSha256);
 const meta=await sharp(sheet).metadata();assert.deepEqual([meta.width,meta.height],[768,1152]);
 for(const s of m.sources){const b=await readFile(new URL(`generated/${s.direction}/frame-${s.frame}.png`,base));assert.equal(hash(b),s.sha256);const region=await sharp(sheet).extract({left:(s.frame-1)*192,top:m.directions.indexOf(s.direction)*288,width:192,height:288}).raw().toBuffer();assert.deepEqual(region,await sharp(b).raw().toBuffer());}
});
test('authored skeleton uses the newly authorized 72 / 144 / 216 dimensions',async()=>{
 const s=await json(new URL('../../common-three-head-216-v1/skeleton.json',base));
 assert.deepEqual(s.canvas,[192,288]);
 assert.deepEqual([s.geometry.headHeight,s.geometry.bodyHeight,s.geometry.characterHeight],[72,144,216]);
 assert.equal(s.geometry.headBottom-s.geometry.headTop,72);assert.equal(s.geometry.baselineY-s.geometry.headBottom,144);
 for(const bones of[s.bones,...Object.values(s.projections).map(p=>p.bones)])for(const[name,b]of Object.entries(bones)){
  assert.ok(b.pivot.every(Number.isFinite));assert.ok(b.parent===null||bones[b.parent]);
  const seen=new Set([name]);let parent=b.parent;while(parent){assert.ok(!seen.has(parent),'no cyclic bone parents');seen.add(parent);parent=bones[parent].parent;}
 }
});
for(const id of['guest-01','guest-02','guest-03','guest-04','guest-05','guest-06','guest-07','guest-08','guest-09','guest-10','guest-11','guest-12'])for(const direction of['front','left','right','back']){
 const base=new URL(`../character-assets/rigs/${id}/three-head-216-v1/`,import.meta.url);
 test(`${id} 216 ${direction}: actual pixels, stable head, continuous neck and grounded neutral gait`,async()=>{
  const m=await json(new URL(`generated/${direction}/manifest.json`,base)),frames=[];
  assert.equal(m.runtimeEnabled,false);assert.equal(m.headOpaqueBounds.height,72);
  for(let i=1;i<=4;i++){
   const b=await readFile(new URL(`generated/${direction}/frame-${i}.png`,base));assert.equal(hash(b),m.frames[i-1].sha256);
   const{data,info}=await sharp(b).raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height,info.channels],[192,288,4]);
   let top=288,bottom=-1;for(let y=0;y<288;y++)for(let x=0;x<192;x++)if(data[(y*192+x)*4+3]>=128){top=Math.min(top,y);bottom=Math.max(bottom,y);}
   assert.deepEqual([top,bottom,bottom-top+1],[54,269,216]);
   for(let y=125;y<=139;y++){let covered=false;for(let x=84;x<=108;x++)if(data[(y*192+x)*4+3]>=128)covered=true;assert.ok(covered,`neck/shoulder alpha break at y=${y}`);}
   const svg=await readFile(new URL(`generated/${direction}/frame-${i}.svg`,base),'utf8');
   for(const match of svg.matchAll(/rotate\(([^)]*)\)/g)){const numbers=match[1].trim().split(/\s+/);assert.equal(numbers.length,3);assert.ok(numbers.every(n=>Number.isFinite(Number(n))),'only finite scalar angles/pivots, never root arrays');}
   frames.push(data);
  }
  assert.deepEqual(frames[1],frames[3]);assert.notDeepEqual(frames[0],frames[2]);
  const centers=m.frames.map(f=>(f.silhouette.left+f.silhouette.right)/2);
  assert.ok((Math.max(...centers)-Math.min(...centers))/4<=1,'center motion <=1px at 48x72, without moving the root');
  for(const f of frames)assert.deepEqual(f.subarray(0,126*192*4),frames[1].subarray(0,126*192*4));
  for(const source of m.sources)assert.equal(hash(await readFile(new URL(source.file,base))),source.sha256);
 });
 test(`${id} 216 ${direction}: independently rendered shoes alternate forward sides`,async()=>{
  const m=await json(new URL(`generated/${direction}/manifest.json`,base));
  const a=m.frames[0].feet,b=m.frames[2].feet;
  assert.ok(a.Left&&a.Right&&b.Left&&b.Right);
  if(direction==='front'){assert.ok(a.Left.bottom-a.Right.bottom>=7);assert.ok(b.Right.bottom-b.Left.bottom>=7);}
  else if(direction==='back'){assert.ok(a.Right.bottom-a.Left.bottom>=7);assert.ok(b.Left.bottom-b.Right.bottom>=7);}
  else if(direction==='left'){assert.ok(a.Left.left-a.Right.left>=5);assert.ok(b.Right.left-b.Left.left>=5);}
  else{assert.ok(a.Left.right-a.Right.right>=5);assert.ok(b.Right.right-b.Left.right>=5);}
 });
}
