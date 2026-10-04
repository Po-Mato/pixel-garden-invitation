import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {neckSource,neckSourceFile} from './lib/hanbokNeckSource.mjs';
import sharp from './lib/deterministicSharp.mjs';
import {canonicalBones,poseMatrix,groundFrame,posePoint} from './lib/canonicalCutoutBinding.mjs';
import {upperArmSkin} from './lib/paintedArmPose.mjs';
import {alphaConnection} from './lib/storybookJointConnections.mjs';
import {packCharacterFrames} from './lib/packCharacterFrames.mjs';
import {beginPaintedRender,finishPaintedRender,verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';
const root=path.resolve(import.meta.dirname,'..'),rigs=path.join(root,'character-assets/rigs'),base=path.join(rigs,'hanbok-directions-v8');
const inputs=new Set(),read=async p=>{inputs.add(p);return fs.readFile(p)},json=async p=>JSON.parse(await read(p));
for(const p of ['scripts/render-hanbok-back-rig-v8.mjs','scripts/lib/canonicalCutoutBinding.mjs','scripts/lib/paintedArmPose.mjs'])await read(path.join(root,p));
const art=await json(path.join(base,'registration.json')),partConfig=await json(path.join(base,'back-rig/source/parts.json'));
const shared=await json(path.resolve(base,'back-rig/source',partConfig.skeleton)),bones=canonicalBones(shared,'back');
const motion=await json(path.join(rigs,'shared-tailored-216-v1/painted-walk-binding.json')),animation=await json(path.join(rigs,'common-three-head-216-v1/animations/dress-back.json'));
const wrap=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${s}</svg>`,matrix=m=>m.map(n=>Number(n.toFixed(10))).join(' ');
const image=(b,mime='image/svg+xml',w=192,h=288)=>`<image width="${w}" height="${h}" href="data:${mime};base64,${b.toString('base64')}"/>`;
const alpha=async s=>sharp(Buffer.from(wrap(s))).ensureAlpha().extractChannel(3).raw().toBuffer();
const contacts=[],records=[];
await read(path.join(root,'scripts/lib/hanbokNeckSource.mjs'));
const necks=await json(path.join(root,neckSourceFile));
for(const [id,c]of Object.entries(art.characters)){
 const canonical=path.join(rigs,id,'canonical-binding-v1'),receipt=path.join(canonical,'review/source-render-receipt.json');await verifyPaintedRenderReceipt(root,receipt);
 const prepared=await json(path.join(canonical,'review/audit.json')),front=prepared.directions.find(d=>d.direction==='back');
 const out=path.join(base,'back-rig',id);await fs.mkdir(out,{recursive:true});
 const body=await read(path.join(base,c.source)),registered=`<g transform="translate(${c.translation.join(' ')}) scale(${c.scale})">${image(body,'image/png',1536,1024)}</g>`;
 const layers=[],outputs=[];
 for(const p of front.bindings){if(/^(upperArm|forearm|hand|torso)/.test(p.name))continue;layers.push({...p,material:image(p.name==='neck-back'?neckSource(necks,id,'back'):await read(path.join(root,p.registeredSource)))});}
 const characterParts=partConfig.parts.map(p=>({...p,mask:partConfig.characterMasks?.[id]?.[p.name]??p.mask}));
 for(const p of characterParts){
  assert.deepEqual(p.pivot,bones[p.parent].pivot);
  const material=`<defs><clipPath id="cutout-${p.name}"><path d="${p.mask}"/></clipPath></defs><g clip-path="url(#cutout-${p.name})">${registered}</g>`;
  const file=path.join(out,p.name+'.svg');await fs.writeFile(file,wrap(material));outputs.push(file);layers.push({...p,material:image(Buffer.from(wrap(material)))});
 }
 layers.sort((a,b)=>a.priority-b.priority);
 const frames=[],raws=[],audit=[];
 for(const [index,key]of animation.frames.entries()){
  const frame=groundFrame(bones,'back',key),parts=[],alphas=new Map();
  for(const p of layers){
   let content=p.material;const leg=/^(thigh|calf|shoe)/.test(p.name),arm=/^(upperArm|forearm|hand)/.test(p.name),side=p.name.endsWith('Left')?'Left':'Right';
   if(key.forward){
    if(p.name.startsWith('upperArm'))content=upperArmSkin(content,bones,p.name,{rotations:{}},frame,motion);
    else if(arm||leg)content=`<g transform="matrix(${matrix(poseMatrix(bones,p.name,frame))})">${content}</g>`;
    if(leg)content=`<g transform="translate(0 ${frame.depth[side]})">${content}</g>`;
   }
   alphas.set(p.name,await alpha(content));parts.push(content);
  }
  const svg=wrap(parts.join('')),png=await sharp(Buffer.from(svg)).png().toBuffer(),raw=await sharp(png).ensureAlpha().raw().toBuffer();
  const pairs=[['neck-back','torso-back']];for(const side of ['Left','Right'])pairs.push(['torso-back','upperArm'+side],['upperArm'+side,'forearm'+side],['forearm'+side,'hand'+side]);
  const connections=pairs.map(([a,b])=>({a,b,...alphaConnection(alphas.get(a),alphas.get(b))}));assert.ok(connections.every(c=>c.connected),JSON.stringify({id,index,connections}));
  let y0=288,y1=-1,x0=192,x1=-1;for(let y=0;y<288;y++)for(let x=0;x<192;x++)if(raw[(y*192+x)*4+3]>=128){y0=Math.min(y0,y);y1=Math.max(y1,y);x0=Math.min(x0,x);x1=Math.max(x1,x);}
  assert.equal(y0,54);assert.equal(y1,269);
  for(const [ext,data]of [['svg',svg],['png',png]]){const f=path.join(out,`back-${index+1}.${ext}`);await fs.writeFile(f,data);outputs.push(f);}
  frames.push({input:png,left:index*192,top:0});raws.push(raw);audit.push({frame:index+1,forward:key.forward,connections,center:(x0+x1)/2,baseline:270,pose:frame});
 }
 assert.deepEqual(raws[1],raws[3]);assert.notDeepEqual(raws[0],raws[2]);
 for(const r of raws)assert.deepEqual(r.subarray(0,192*145*4),raws[1].subarray(0,192*145*4));
 assert.ok((Math.max(...audit.map(f=>f.center))-Math.min(...audit.map(f=>f.center)))/4<=1);
 const sheet=await packCharacterFrames(768,288,frames);const f=path.join(out,'back-walk.png');await fs.writeFile(f,sheet);outputs.push(f);contacts.push({input:sheet,left:0,top:contacts.length*288});
 const report=path.join(out,'audit.json');await fs.writeFile(report,JSON.stringify({id,status:'back-rig-only',productionApproved:false,geometry:shared.geometry,bones,parts:characterParts,frames:audit},null,2)+'\n');outputs.push(report);
 await finishPaintedRender(root,path.join(out,'receipt.json'),await beginPaintedRender(root,[...inputs],[receipt]),outputs);records.push({id,sheet:f,frames:4});
}
await sharp({create:{width:768,height:576,channels:4,background:'#e8e6dc'}}).composite(contacts).png().toFile(path.join(base,'back-rig/contact.png'));
console.log(JSON.stringify(records));
