import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {collarLayers,collarFile} from './lib/hanbokCollarLayers.mjs';
import {neckSource,neckSourceFile} from './lib/hanbokNeckSource.mjs';
import sharp from './lib/deterministicSharp.mjs';
import {canonicalBones,poseMatrix,groundFrame} from './lib/canonicalCutoutBinding.mjs';
import {upperArmSkin} from './lib/paintedArmPose.mjs';
import {alphaConnection} from './lib/storybookJointConnections.mjs';
import {packCharacterFrames} from './lib/packCharacterFrames.mjs';
import {beginPaintedRender,finishPaintedRender,verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';
const root=path.resolve(import.meta.dirname,'..'),rigs=path.join(root,'character-assets/rigs'),base=path.join(rigs,'hanbok-directions-v8');
const inputs=new Set(),read=async p=>{inputs.add(p);return fs.readFile(p)},json=async p=>JSON.parse(await read(p));
for(const name of ['render-hanbok-side-rig-v8.mjs','lib/canonicalCutoutBinding.mjs','lib/paintedArmPose.mjs','lib/storybookJointConnections.mjs','lib/packCharacterFrames.mjs'])await read(path.join(root,'scripts',name));
const art=await json(path.join(base,'side-registration.json')),config=await json(path.join(base,'side-parts.json'));
const shared=await json(path.join(rigs,'shared-tailored-216-v1/skeleton.json')),motion=await json(path.join(rigs,'shared-tailored-216-v1/painted-walk-binding.json'));
const wrap=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${s}</svg>`,mat=m=>m.map(n=>Number(n.toFixed(10))).join(' ');
const image=(b,m='image/svg+xml',w=192,h=288)=>`<image width="${w}" height="${h}" href="data:${m};base64,${b.toString('base64')}"/>`;
const contacts=[];
await read(path.join(root,'scripts/lib/hanbokNeckSource.mjs'));
const necks=await json(path.join(root,neckSourceFile));
const collars=await json(path.join(root,collarFile));await read(path.join(root,'scripts/lib/hanbokCollarLayers.mjs'));
for(const [id,dirs]of Object.entries(art.characters))for(const [dir,c]of Object.entries(dirs)){
 const receipt=path.join(rigs,id,'canonical-binding-v1/review/source-render-receipt.json');await verifyPaintedRenderReceipt(root,receipt);
 const original=(await json(path.join(rigs,id,'canonical-binding-v1/review/audit.json'))).directions.find(d=>d.direction===dir);
 const bones=canonicalBones(shared,dir),near=dir==='left'?'Left':'Right',far=near==='Left'?'Right':'Left',cut=config.characters[id][dir];
 const animation=await json(path.join(rigs,`common-three-head-216-v1/animations/dress-${dir}.json`));
 const out=path.join(base,'side-rig',id,dir);await fs.mkdir(out,{recursive:true});
 const rawSource=await read(path.join(base,'sources',`${id}-${dir}-upperbody.png`));
 const source=`<g transform="translate(${c.translation.join(' ')}) scale(${c.scale})">${image(rawSource,'image/png',1536,1024)}</g>`;
 const edge=cut.boundary.map(p=>p.join(' ')).join(' L '),armEdge=dir==='left'?192:0,torsoEdge=192-armEdge;
 const armMask=`M ${edge} L ${armEdge} 206 L ${armEdge} 126 L ${cut.boundary[0][0]} 126 Z`;
 const torsoMask=`M ${edge} L ${torsoEdge} 206 L ${torsoEdge} 120 L ${cut.boundary[0][0]} 120 Z`;
 const layers=[],outputs=[],parts=[];
 for(const p of original.bindings){
  if(p.name.startsWith('torso')||/^(upperArm|forearm|hand)/.test(p.name)&&p.name.endsWith(near))continue;
  if(id==='guest-12'&&/^(goreum|norigae)/.test(p.name))continue;
  layers.push({...p,material:image(p.name===`neck-${dir}`?neckSource(necks,id,dir):await read(path.join(root,p.registeredSource)))});
 }
 for(const [name,parent,mask,y,h,priority]of [
  [`torso-${dir}`,'spine',torsoMask,0,288,6],
  ['upperArm'+near,'upperArm'+near,armMask,0,172,7],
  ['forearm'+near,'forearm'+near,armMask,168,cut.wrist+4-168,8],
  ['hand'+near,'hand'+near,armMask,cut.wrist,288-cut.wrist,8]
 ]){
  const material=`<defs><clipPath id="outline"><path d="${mask}"/></clipPath><clipPath id="segment"><rect y="${y}" width="192" height="${h}"/></clipPath></defs><g clip-path="url(#outline)"><g clip-path="url(#segment)">${source}</g></g>`;
  const file=path.join(out,name+'.svg');await fs.writeFile(file,wrap(material));outputs.push(file);
  const p={name,parent,pivot:bones[parent].pivot,priority,mask,y,height:h};parts.push(p);layers.push({...p,material:image(Buffer.from(wrap(material)))});
 }
 const collar=collarLayers(collars,id,dir,source),n=layers.find(p=>p.name===`neck-${dir}`);n.material=collar.neck;n.priority=6.4;
 layers.push({name:'collar-front',parent:'spine',pivot:bones.spine.pivot,priority:6.6,material:collar.collar});
 layers.sort((a,b)=>a.priority-b.priority);const frames=[],raws=[],audits=[];
 for(const [i,key]of animation.frames.entries()){
  const pose=groundFrame(bones,dir,key),render=[],alpha=new Map();
  for(const p of layers){
   let s=p.material;const leg=/^(thigh|calf|shoe)/.test(p.name),arm=/^(upperArm|forearm|hand)/.test(p.name);
   if(key.forward){
    if(p.name.startsWith('upperArm'))s=upperArmSkin(s,bones,p.name,{rotations:{}},pose,motion);
    else if(arm||leg)s=`<g transform="matrix(${mat(poseMatrix(bones,p.name,pose))})">${s}</g>`;
    if(leg)s=`<g transform="translate(0 ${pose.depth[p.name.endsWith('Left')?'Left':'Right']})">${s}</g>`;
   }
   render.push(s);alpha.set(p.name,await sharp(Buffer.from(wrap(s))).ensureAlpha().extractChannel(3).raw().toBuffer());
  }
  const pairs=[[`neck-${dir}`,`torso-${dir}`],[`torso-${dir}`,'upperArm'+near],['upperArm'+near,'forearm'+near],['forearm'+near,'hand'+near]];
  const connections=pairs.map(([a,b])=>({a,b,...alphaConnection(alpha.get(a),alpha.get(b))}));assert.ok(connections.every(p=>p.connected),JSON.stringify({id,dir,i,connections}));
  const svg=wrap(render.join('')),png=await sharp(Buffer.from(svg)).png().toBuffer(),raw=await sharp(png).ensureAlpha().raw().toBuffer();raws.push(raw);
  for(const [ext,data]of [['svg',svg],['png',png]]){const f=path.join(out,`${dir}-${i+1}.${ext}`);await fs.writeFile(f,data);outputs.push(f);}
  frames.push({input:png,left:i*192,top:0});audits.push({frame:i+1,forward:key.forward,pose,connections});
 }
 assert.deepEqual(raws[1],raws[3]);assert.notDeepEqual(raws[0],raws[2]);for(const r of raws)assert.deepEqual(r.subarray(0,192*145*4),raws[1].subarray(0,192*145*4));
 const sheet=await packCharacterFrames(768,288,frames),file=path.join(out,'walk.png');await fs.writeFile(file,sheet);outputs.push(file);contacts.push({input:sheet,left:0,top:contacts.length*288});
 const report=path.join(out,'audit.json');await fs.writeFile(report,JSON.stringify({id,dir,productionApproved:false,near,far,farMaterial:'retained original registered source',bones,parts,frames:audits},null,2));outputs.push(report);
 await finishPaintedRender(root,path.join(out,'receipt.json'),await beginPaintedRender(root,[...inputs],[receipt]),outputs);
 console.log(id,dir,'4 frames');
}
await sharp({create:{width:768,height:1152,channels:4,background:'#e8e6dc'}}).composite(contacts).png().toFile(path.join(base,'side-rig/contact.png'));
