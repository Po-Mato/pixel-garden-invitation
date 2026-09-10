import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const root=new URL('../character-assets/rigs/guest-03/',import.meta.url);
const candidate=new URL('three-head-216-v1/',root);
const source=new URL('three-head-soft-tailoring-v1/',root);
const json=async url=>JSON.parse(await readFile(url));
const baseline=await json(new URL('anatomy-baseline.json',source));

for(const direction of ['front','left','right','back'])test(`soft tailoring ${direction}: fixed anatomy and gait`,async()=>{
 const rig=await json(new URL(`${direction}-rig.json`,candidate));
 const old=baseline.directions[direction];
 assert.deepEqual(rig.frames,old.frames);
 assert.equal(rig.skeleton,old.skeleton);
 for(const [name,part] of Object.entries(rig.parts)){
  assert.deepEqual(part.pivot,old.parts[name].pivot);
  assert.equal(part.rect[3],old.parts[name].height,'part length is not an image-size correction');
 }
 const frames=[];
 for(let frame=1;frame<=4;frame++){
  const file=`generated/${direction}/frame-${frame}.png`;
  const {data,info}=await sharp(await readFile(new URL(file,candidate))).raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height,info.channels],[192,288,4]);
  assert.equal(createHash('sha256').update(data.subarray(0,121*192*4)).digest('hex'),old.headSha256,'hair and face artwork untouched');
  let top=288,bottom=-1;
  for(let y=0;y<288;y++)for(let x=0;x<192;x++)if(data[(y*192+x)*4+3]>=128){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  assert.deepEqual([top,bottom,bottom-top+1],[54,269,216]);
  for(let y=125;y<=139;y++)assert.ok(Array.from({length:25},(_,i)=>data[(y*192+84+i)*4+3]).some(a=>a>=128),`neck seam ${y}`);
  frames.push(data);
 }
 assert.deepEqual(frames[1],frames[3]);assert.notDeepEqual(frames[0],frames[2]);
 const m=await json(new URL(`generated/${direction}/manifest.json`,candidate));
 assert.equal(m.headOpaqueBounds.height,72);
 const centers=m.frames.map(f=>(f.silhouette.left+f.silhouette.right)/2);
 assert.ok((Math.max(...centers)-Math.min(...centers))/4<=1);
 const [a,,b]=m.frames.map(f=>f.feet);
 if(direction==='front'){assert.ok(a.Left.bottom-a.Right.bottom>=7);assert.ok(b.Right.bottom-b.Left.bottom>=7);}
 if(direction==='back'){assert.ok(a.Right.bottom-a.Left.bottom>=7);assert.ok(b.Left.bottom-b.Right.bottom>=7);}
 if(direction==='left'){assert.ok(a.Left.left-a.Right.left>=5);assert.ok(b.Right.left-b.Left.left>=5);}
 if(direction==='right'){assert.ok(a.Left.right-a.Right.right>=5);assert.ok(b.Right.right-b.Left.right>=5);}
});

test('accepted source illustrations have genuine transparency and preserved ivory fabric',async()=>{
 for(const [id,name] of [['03','front/torso'],['04','back/torso'],['09','back/torso']]){
  const file=new URL(`../guest-${id}/three-head-soft-tailoring-v1/parts/${name}.png`,root);
  const {data,info}=await sharp(await readFile(file)).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.channels,4);
  let transparent=0,ivory=0;
  for(let i=0;i<data.length;i+=4){if(data[i+3]===0)transparent++;if(data[i+3]>=250&&data[i]>200&&data[i+1]>190&&data[i+2]>175)ivory++;}
  assert.ok(transparent>info.width*info.height*.05,'no opaque checkerboard backdrop');
  assert.ok(ivory>100,'shirt or cuff must remain opaque');
 }
});
