import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from './lib/deterministicSharp.mjs';
import {beginPaintedRender,finishPaintedRender,verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';
import {canonicalBones,limbNames,posePoint,poseMatrix,groundFrame,segmentRegistration} from './lib/canonicalCutoutBinding.mjs';
import {alphaConnection} from './lib/storybookJointConnections.mjs';
import {packCharacterFrames} from './lib/packCharacterFrames.mjs';
import {upperArmSkin} from './lib/paintedArmPose.mjs';
const root=path.resolve(import.meta.dirname,'..'),id=process.argv[2];assert.ok(['guest-01','guest-02','guest-05','guest-06','guest-07','guest-08','guest-10','guest-12'].includes(id));
const base=path.join(root,'character-assets/rigs',id,'canonical-binding-v1'),out=path.join(base,'walk-review');await fs.mkdir(out,{recursive:true});
const files=new Set();const read=async f=>{files.add(f);return fs.readFile(f);},json=async f=>JSON.parse(await read(f));
await read(import.meta.filename);await read(path.join(root,'scripts/lib/canonicalCutoutBinding.mjs'));
await read(path.join(root,'scripts/lib/paintedArmPose.mjs'));
const sourceReceipt=path.join(base,'review/source-render-receipt.json');await verifyPaintedRenderReceipt(root,sourceReceipt);
const prepared=await json(path.join(base,'review/audit.json'));assert.equal(prepared.disconnected.length,0,'Neutral source joints must be connected');
const binding=await json(path.join(base,'source/binding.json'));
const source=path.resolve(base,'source',binding.sourceDirectory),rig=await json(path.join(source,'body-registration.json'));
const targetFile=path.resolve(base,'source',binding.targetSkeleton),target=await json(targetFile);
const motionDir=path.dirname(targetFile),motion=await json(path.join(motionDir,'painted-walk-binding.json'));
const cloth=binding.clothAnimation?await json(path.resolve(base,'source',binding.clothAnimation)):rig.clothAnimation?await json(path.resolve(source,rig.skeleton,'..',rig.clothAnimation)):null;
const mask=rig.legVisibility?await read(path.resolve(source,rig.legVisibility.source)):null;
const wrap=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${s}</svg>`;
const image=b=>`<image width="192" height="288" href="data:image/svg+xml;base64,${b.toString('base64')}"/>`;
const matrix=m=>m.map(n=>Number(n.toFixed(10))).join(' ');
const alpha=b=>sharp(b).ensureAlpha().extractChannel(3).raw().toBuffer();
const tiles=[],audit=[],outputs=[];
for(const [row,d]of prepared.directions.entries()){
 const bones=canonicalBones(target,d.direction);assert.deepEqual(d.bones,bones);
 const animation=await json(path.resolve(motionDir,motion.sourceMotionDirectory,`${motion.motionFamily}-${d.direction}.json`));
 const parts=await Promise.all([...d.bindings].sort((a,b)=>a.priority-b.priority).map(async p=>({...p,material:image(await read(path.join(root,p.registeredSource)))})));
 const neutral=await sharp(await read(path.join(base,'review',d.direction+'.png'))).ensureAlpha().raw().toBuffer();
 const rendered=[],centers=[];
 for(const [index,key]of animation.frames.entries()){
  const rest=d.restPose||{rotations:{}},rotations={...rest.rotations};
  for(const [bone,angle]of Object.entries(key.rotations||{}))rotations[bone]=(rotations[bone]||0)+angle;
  const frame=groundFrame(bones,d.direction,{...key,rotations}),layers=[],alphas=new Map(),footPositions={};
  for(const part of parts){
   const name=part.name,side=name.endsWith('Left')?'Left':'Right',limb=limbNames.includes(name),leg=/^(thigh|calf|shoe)/.test(name);
   let content=part.material;
   if(key.forward||Object.keys(rest.rotations).length){
    if(limb){
     if(name.startsWith('upperArm')){
      content=upperArmSkin(part.material,bones,name,rest,frame,motion);
     }else content=`<g transform="matrix(${matrix(poseMatrix(bones,name,frame))})">${content}</g>`;
     if(leg)content=`<g transform="translate(0 ${Number(frame.depth[side].toFixed(10))})">${content}</g>`;
    }else if(part.parent.startsWith('hand'))content=`<g transform="matrix(${matrix(poseMatrix(bones,part.parent,frame))})">${content}</g>`;
    else if(key.forward&&cloth&&name.startsWith('skirt'))content=`<g transform="rotate(${cloth.directions[d.direction][index]} ${cloth.pivot.join(' ')})">${content}</g>`;
   }
   alphas.set(name,await alpha(Buffer.from(wrap(content))));
   if(mask&&leg)content=`<defs><mask id="${name}-visibility" maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="288">${image(mask)}</mask></defs><g mask="url(#${name}-visibility)">${content}</g>`;
   layers.push(content);
  }
  const svg=wrap(layers.join('')),png=await sharp(Buffer.from(svg)).png().toBuffer(),raw=await sharp(png).ensureAlpha().raw().toBuffer();
  const top=192*145*4;assert.deepEqual(raw.subarray(0,top),neutral.subarray(0,top),'Head, neck and shoulder cap must stay rigid');
  let x0=192,x1=-1,y0=288,y1=-1;for(let i=3;i<raw.length;i+=4)if(raw[i]>=128){const p=(i-3)/4,x=p%192,y=Math.floor(p/192);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  assert.equal(y0,54);assert.equal(y1,269,'Source-foot contact must stay at 270');centers.push((x0+x1)/2);
  const pairs=[[`neck-${d.direction}`,`torso-${d.direction}`]];
  for(const side of ['Left','Right']){
   pairs.push([`torso-${d.direction}`,'upperArm'+side],['upperArm'+side,'forearm'+side],['forearm'+side,'hand'+side],['thigh'+side,'calf'+side],['calf'+side,'shoe'+side]);
   const shoe='shoe'+side,p=posePoint(bones,shoe,[bones[shoe].pivot[0],270],frame);footPositions[side]=[p[0],p[1]+frame.depth[side]];
  }
  const connections=pairs.map(([a,b])=>({a,b,...alphaConnection(alphas.get(a),alphas.get(b))}));
  assert.ok(connections.every(c=>c.connected),JSON.stringify({direction:d.direction,index,failed:connections.filter(c=>!c.connected)}));
  if(key.forward&&['left','right'].includes(d.direction)){const travel=d.direction==='left'?-1:1,other=key.forward==='Left'?'Right':'Left';assert.ok(travel*(footPositions[key.forward][0]-footPositions[other][0])>0,'Foot advance must follow actual direction');}
  rendered.push(raw);tiles.push({input:png,left:index*192,top:row*288});
  for(const [ext,bytes]of [['svg',svg],['png',png]]){const file=path.join(out,`${d.direction}-${index+1}.${ext}`);await fs.writeFile(file,bytes);outputs.push(file);}
  audit.push({direction:d.direction,frame:index+1,forward:key.forward,bones,pose:frame,footPositions,connections,headShoulderFixed:true,baseline:270});
 }
 assert.deepEqual(rendered[1],rendered[3]);
 // Visibility may hide covered legs; compare head/body neutral via the exact source renderer, not a patched frame.
 if(!mask)assert.deepEqual(rendered[1],neutral);
 assert.notDeepEqual(rendered[0],rendered[2]);assert.ok((Math.max(...centers)-Math.min(...centers))/4<=1,'Display center drift');
}
const sheet=await packCharacterFrames(768,1152,tiles);
for(const [file,png]of [['walk-sheet.png',sheet],['contact.png',await sharp(sheet).flatten({background:'#e8e6dc'}).png().toBuffer()],['selection-sheet.png',await sharp(sheet).resize(384,576).png().toBuffer()],['game-sheet.png',await sharp(sheet).resize(192,288).png().toBuffer()]]){const f=path.join(out,file);await fs.writeFile(f,png);outputs.push(f);}
const report=path.join(out,'audit.json');await fs.writeFile(report,JSON.stringify({status:'canonical-walk-candidate',runtimeEligible:false,visualApproved:false,geometry:target.geometry,frames:audit},null,2)+'\n');outputs.push(report);
const receipt=await beginPaintedRender(root,[...files],[sourceReceipt]);await finishPaintedRender(root,path.join(out,'walk-render-receipt.json'),receipt,outputs);
console.log(JSON.stringify({id,frames:audit.length,connections:audit.reduce((n,f)=>n+f.connections.length,0),out}));
