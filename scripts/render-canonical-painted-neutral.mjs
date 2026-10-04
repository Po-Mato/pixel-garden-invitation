import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from './lib/deterministicSharp.mjs';
import {verifyPaintedRenderReceipt,beginPaintedRender,finishPaintedRender} from './lib/paintedRenderReceipt.mjs';
import {canonicalBones,limbNames,boneRegistration,segmentRegistration,poseMatrix} from './lib/canonicalCutoutBinding.mjs';
import {alphaConnection} from './lib/storybookJointConnections.mjs';
import {upperArmSkin} from './lib/paintedArmPose.mjs';
const id=process.argv[2];assert.ok(['guest-01','guest-02','guest-05','guest-06','guest-07','guest-08','guest-10','guest-12'].includes(id));
const root=path.resolve(import.meta.dirname,'..'),base=path.join(root,'character-assets/rigs',id);
const out=path.join(base,'canonical-binding-v1/review');await fs.mkdir(out,{recursive:true});
const inputs={};const read=async f=>{const b=await fs.readFile(f);inputs[path.relative(root,f)]=createHash('sha256').update(b).digest('hex');return b;};
await read(import.meta.filename);await read(path.join(root,'scripts/lib/canonicalCutoutBinding.mjs'));
await read(path.join(root,'scripts/lib/paintedArmPose.mjs'));
const json=async f=>JSON.parse(await read(f));
const config=await json(path.join(base,'canonical-binding-v1/source/binding.json'));
const source=path.resolve(base,'canonical-binding-v1/source',config.sourceDirectory);
const materialDirectory=path.join(source,config.materialDirectory||'generated');
const receipt=path.join(materialDirectory,config.sourceReceipt||'walk-render-receipt.json');await verifyPaintedRenderReceipt(root,receipt);await read(receipt);
const rig=await json(path.join(source,'body-registration.json')),head=await json(path.join(source,'head-registration.json'));
const anchor=id==='guest-05',anchorFront=anchor?await json(path.resolve(source,'../storybook-body-v1/front-registration.json')):null;
const skeleton=await json(path.resolve(source,rig.skeleton)),target=await json(path.resolve(base,'canonical-binding-v1/source',config.targetSkeleton));
const armMotion=await json(path.resolve(base,'canonical-binding-v1/source',config.targetSkeleton,'../painted-walk-binding.json'));
const wrap=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${s}</svg>`;
const image=b=>`<image width="192" height="288" href="data:image/svg+xml;base64,${b.toString('base64')}"/>`;
const alpha=b=>sharp(b).ensureAlpha().extractChannel(3).raw().toBuffer();
const tiles=[],directions=[];
const outputs=[],registered=path.join(base,'canonical-binding-v1/generated/registered');await fs.mkdir(registered,{recursive:true});
for(const [row,direction]of ['front','left','right','back'].entries()){
 const old=direction==='front'?skeleton.bones:skeleton.projections[direction].bones,newBones=canonicalBones(target,direction);
 const restPose={rotations:direction==='back'?(config.backRestPose||{}):{}};
 const nearSide=direction==='left'?'Left':direction==='right'?'Right':null;
 const items=[],bindings=[];
 async function add(name,file,parent,priority,registration){
  const material=await read(file),matrix=registration?.matrix;
  let bound=matrix?`<g transform="matrix(${matrix.join(' ')})">${image(material)}</g>`:image(material);
  const sleeveKey=name.replace(/^(forearm|hand)/,'upperArm');
  const sleeve=config.sleeveArtwork?.[direction]?.[sleeveKey];
  if(sleeve){
   const sleeveFile=path.resolve(base,'canonical-binding-v1/source',sleeve),art=await read(sleeveFile);
   const wrist=newBones[name.replace(/^(upperArm|forearm)/,'hand')].pivot[1];
   // Authored sleeve replaces only sleeve material. Original hands remain separate
   // source artwork; no final animation frame is ever sampled or patched.
   bound=`<defs><clipPath id="original-hand"><rect y="${wrist-4}" width="192" height="288"/></clipPath></defs><g clip-path="url(#original-hand)">${bound}</g>${image(art)}`;
   registration.sleeveArtwork=path.relative(root,sleeveFile);
  }
  if(registration?.sourceClip){const [y,height]=registration.sourceClip;bound=`<defs><clipPath id="arm-source-region"><rect y="${y}" width="192" height="${height}"/></clipPath></defs><g clip-path="url(#arm-source-region)">${bound}</g>`;}
  const bytes=Buffer.from(wrap(bound)),registeredFile=path.join(registered,`${direction}-${name}.svg`);await fs.writeFile(registeredFile,bytes);outputs.push(registeredFile);
  let content=image(bytes);
  if(direction==='back'&&parent.startsWith('upperArm'))content=upperArmSkin(content,newBones,parent,restPose,restPose,armMotion);
  else if(direction==='back'&&/^(forearm|hand)/.test(parent))content=`<g transform="matrix(${poseMatrix(newBones,parent,restPose).map(n=>Number(n.toFixed(10))).join(' ')})">${content}</g>`;
  items.push({name,content,parent,priority,alpha:await alpha(Buffer.from(wrap(content)))});
  bindings.push({name,source:path.relative(root,file),registeredSource:path.relative(root,registeredFile),priority,parent,pivot:newBones[parent]?.pivot??[96,270],...(registration?{registration}:{}),mirrored:false});
 }
 const headDirectory=path.join(source,config.headDirectories?.[direction]||'generated');
 if(head.splitBodyOcclusion)await add('headBehind',path.join(headDirectory,`head-${direction}-behind-body.svg`),'head',1);
 const anchorFrontDirection=anchor&&direction==='front',partDirectory=anchorFrontDirection?path.resolve(source,'../storybook-body-v1/generated'):materialDirectory;
 if(anchor){
  const shadow=anchorFrontDirection?anchorFront.shadow:rig.shadow;
  await add(`shadow-${direction}`,path.resolve(anchorFrontDirection?path.resolve(source,'../storybook-body-v1'):source,shadow.source),'root',0);
  await add(`neck-${direction}`,anchorFrontDirection?path.resolve(source,'../storybook-body-v1/neck-front.svg'):path.join(source,'neck-skin.svg'),'neck',4);
 }
 const sourceParts=anchorFrontDirection?anchorFront.parts.map(p=>({...p,sourceId:p.id,id:['torso','skirt','bag'].includes(p.id)?p.id+'-front':p.id})):rig.parts.filter(p=>p.direction===direction);
 for(const part of sourceParts){
  const kind=part.parent.startsWith('upperArm')?'arm':part.parent.startsWith('thigh')?'leg':null;
  if(kind){
   const side=part.parent.endsWith('Left')?'Left':'Right';
   for(const name of kind==='arm'?['upperArm','forearm','hand']:['thigh','calf','shoe']){
    const bone=name+side,registration=boneRegistration(old,newBones,bone);
    const priority=kind==='leg'?3:direction==='back'&&name==='upperArm'&&config.backArmDepth==='behind-torso'?5.5:nearSide&&side!==nearSide?2:8;
    if(kind==='arm'&&config.armContinuity){
     const sourceParent=config.armContinuity.sourceBones?.[direction]?.[part.parent]||part.parent;
     const arm=sourceParts.find(p=>p.parent===sourceParent);assert.ok(arm,'Explicit direction arm source must exist');
     const sourceSide=sourceParent.endsWith('Left')?'Left':'Right';
     const registration=segmentRegistration(old[sourceParent].pivot,old['hand'+sourceSide].pivot,newBones['upperArm'+side].pivot,newBones['hand'+side].pivot);
     // Authored skin breadth, not a per-frame fit. Both joint endpoints stay fixed.
     const breadth=config.armContinuity.breadth?.[direction]??1;
     const [px,py]=old[sourceParent].pivot,[qx,qy]=old['hand'+sourceSide].pivot,l=Math.hypot(qx-px,qy-py),nx=-(qy-py)/l,ny=(qx-px)/l;
     const normal=segmentRegistration([px,py],[qx,qy],newBones['upperArm'+side].pivot,newBones['hand'+side].pivot).matrix;
     const vx=normal[0]*nx+normal[2]*ny,vy=normal[1]*nx+normal[3]*ny,k=breadth-1;
     registration.matrix[0]+=k*vx*nx;registration.matrix[1]+=k*vy*nx;registration.matrix[2]+=k*vx*ny;registration.matrix[3]+=k*vy*ny;
     registration.matrix[4]-=k*vx*(nx*px+ny*py);registration.matrix[5]-=k*vy*(nx*px+ny*py);registration.breadth=breadth;
     const elbow=newBones['forearm'+side].pivot[1],wrist=newBones['hand'+side].pivot[1];
     registration.sourceClip=name==='upperArm'?[0,elbow+2]:name==='forearm'?[elbow-2,wrist-elbow+4]:[wrist-2,288-wrist+2];
     registration.sourceBone=sourceParent;registration.continuousArm=true;
     await add(bone,path.join(partDirectory,`${arm.sourceId||arm.id}-registered.svg`),bone,priority,registration);
    }else await add(bone,anchorFrontDirection?path.join(partDirectory,'joint-parts',bone+'.svg'):path.join(materialDirectory,`${direction}-${bone}-source.svg`),bone,priority,registration);
   }
  }else{
   const accessory=part.parent.startsWith('hand'),side=part.parent.endsWith('Left')?'Left':'Right';
   const registration=accessory?boneRegistration(old,newBones,part.parent):null;
   const priority=part.id.startsWith('shadow')?0:part.id.startsWith('neck')?4:part.id.startsWith('skirt')?5:part.id.startsWith('torso')?6:accessory&&nearSide&&side!==nearSide?4:7;
   await add(part.id,path.join(partDirectory,`${part.sourceId||part.id}-registered.svg`),part.parent,priority,registration);
  }
 }
 await add('headAbove',anchorFrontDirection?path.join(partDirectory,'head-registered.svg'):path.join(headDirectory,`head-${direction}-${head.splitBodyOcclusion?'above-body':'registered'}.svg`),'head',9);
 assert.equal(bindings.filter(b=>limbNames.includes(b.name)).length,12);
 const ordered=items.sort((a,b)=>a.priority-b.priority),svg=wrap(ordered.map(x=>x.content).join(''));
 const png=await sharp(Buffer.from(svg)).png().toBuffer();
 await fs.writeFile(path.join(out,`${direction}.svg`),svg);await fs.writeFile(path.join(out,`${direction}.png`),png);tiles.push({input:png,left:row*192,top:0});
 outputs.push(path.join(out,`${direction}.svg`),path.join(out,`${direction}.png`));
 const byName=new Map(items.map(i=>[i.name,i])),pairs=[[`neck-${direction}`,`torso-${direction}`]];
 for(const side of ['Left','Right'])pairs.push([`torso-${direction}`,'upperArm'+side],['upperArm'+side,'forearm'+side],['forearm'+side,'hand'+side],['thigh'+side,'calf'+side],['calf'+side,'shoe'+side]);
 const connections=pairs.map(([a,b])=>({a,b,...alphaConnection(byName.get(a).alpha,byName.get(b).alpha)}));
 directions.push({direction,bones:newBones,restPose,bindings,connections,nearSide,accessoryRule:'Body-side ownership sets depth order; no direction image is mirrored.'});
}
await sharp({create:{width:768,height:288,channels:4,background:'#e8e6dc'}}).composite(tiles).png().toFile(path.join(out,'neutral-contact.png'));
await fs.writeFile(path.join(out,'audit.json'),JSON.stringify({status:'canonical-neutral-candidate',runtimeEligible:false,visualApproved:false,inputs,directions,disconnected:directions.flatMap(d=>d.connections.filter(c=>!c.connected).map(c=>({direction:d.direction,...c})))},null,2)+'\n');
 const provenance=await beginPaintedRender(root,Object.keys(inputs),[receipt]);
 await finishPaintedRender(root,path.join(out,'source-render-receipt.json'),provenance,[...outputs,path.join(out,'neutral-contact.png'),path.join(out,'audit.json')]);
console.log(JSON.stringify({id,out,disconnected:directions.flatMap(d=>d.connections.filter(c=>!c.connected)).length}));
