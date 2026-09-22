import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {packCharacterFrames} from './lib/packCharacterFrames.mjs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-05/storybook-directions-v1');
const out=path.join(base,'generated');
const rig=JSON.parse(await fs.readFile(path.join(base,'body-registration.json')));
const common=path.resolve(base,rig.skeleton,'..');
const skeleton=JSON.parse(await fs.readFile(path.resolve(base,rig.skeleton)));
assert.equal(rig.shadow.parent,'root');assert.deepEqual(rig.shadow.pivot,skeleton.bones.root.pivot);
const contact=JSON.parse(await fs.readFile(path.join(common,'animations/painted-dress-contact-v1.json')));
const image=async file=>`<image width="192" height="288" href="data:image/svg+xml;base64,${(await fs.readFile(file)).toString('base64')}"/>`;
const tiles=[],audits=[];
for(const [row,direction] of ['left','right','back'].entries()){
  const bones=skeleton.projections[direction].bones;
  const motion=JSON.parse(await fs.readFile(path.join(common,`animations/dress-${direction}.json`)));
  for(const [index,depth] of Object.entries(contact.directions[direction]||{}))Object.assign(motion.frames[index].depth,depth);
  const parts=rig.parts.filter(p=>p.direction===direction);
  const chain=id=>{const result=[];for(let p=id;p;p=bones[p].parent)result.unshift(p);return result;};
  const transform=(id,frame)=>chain(id).map(b=>{const [x,y]=bones[b].pivot;return `translate(${x} ${y}) rotate(${frame.rotations[b]||0}) translate(${-x} ${-y})`;}).join(' ');
  const jointParts=new Map();
  const bindings=[];
  for(const p of parts){
    const limb=p.parent.startsWith('thigh')?'leg':p.parent.startsWith('upperArm')?'arm':null;
    if(!limb)continue;
    const side=p.parent.endsWith('Left')?'Left':'Right';
    const regions=limb==='leg'?[['thigh',0,223],['calf',223,254],['shoe',254,288]]:[['upperArm',0,162],['forearm',162,179],['hand',179,288]];
    const material=await image(path.join(out,`${p.id}-registered.svg`));
    const joints=[];
    for(const [name,start,end] of regions){
      const id=name+side,y=Math.max(0,start-3),bottom=Math.min(288,end+3);
      // Partition editable registered source material; never read a completed walk PNG.
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><defs><clipPath id="source-region"><rect x="0" y="${y}" width="192" height="${bottom-y}"/></clipPath></defs><g clip-path="url(#source-region)">${material}</g></svg>`;
      const file=path.join(out,`${direction}-${id}-source.svg`);await fs.writeFile(file,svg);
      joints.push({id,image:await image(file),side,limb});
      bindings.push({id,parent:bones[id].parent,pivot:bones[id].pivot,source:p.id,region:[start,end],overlapPixels:3});
    }
    jointParts.set(p.id,joints);
  }
  await fs.writeFile(path.join(out,`${direction}-joint-bindings.json`),JSON.stringify({direction,parts:bindings,runtimeEligible:false},null,2)+'\n');
  const frames=[];
  for(const [column,frame] of motion.frames.entries()){
    const layers=[await image(path.resolve(base,rig.shadow.source)),await image(path.join(base,'neck-skin.svg'))];
    for(const p of [...parts.filter(p=>p.layer!=='nearArm'),...parts.filter(p=>p.layer==='nearArm')]){
      if(jointParts.has(p.id))for(const j of jointParts.get(p.id))layers.push(`<g transform="translate(0 ${j.limb==='leg'?(frame.depth[j.side]||0):0}) ${transform(j.id,frame)}">${j.image}</g>`);
      else layers.push(`<g transform="${transform(p.parent,frame)}">${await image(path.join(out,`${p.id}-registered.svg`))}</g>`);
    }
    layers.push(await image(path.join(out,`head-${direction}-registered.svg`)));
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${layers.join('')}</svg>`;
    await fs.writeFile(path.join(out,`${direction}-walk-${column+1}.svg`),svg);
    const png=await sharp(Buffer.from(svg)).png().toBuffer();frames.push(png);
    await fs.writeFile(path.join(out,`${direction}-walk-${column+1}.png`),png);
    tiles.push({input:png,left:column*192,top:row*288});
  }
  assert.deepEqual(frames[1],frames[3]);assert.notDeepEqual(frames[0],frames[2]);
  audits.push({direction,motion:motion.id,contactKeys:contact.id,forwardFeet:motion.frames.map(f=>f.forward),jointCount:bindings.length,neutralIdentical:true});
}
await sharp({create:{width:768,height:864,channels:4,background:'#c7d7bd'}}).composite(tiles).png().toFile(path.join(out,'direction-walk-review.png'));
const sheetTiles=[];
for(const [row,direction] of ['front','left','right','back'].entries())for(let frame=1;frame<=4;frame++){
  const file=direction==='front'?path.join(base,'../storybook-body-v1/generated',`front-walk-${frame}.png`):path.join(out,`${direction}-walk-${frame}.png`);
  sheetTiles.push({input:await fs.readFile(file),left:(frame-1)*192,top:row*288});
}
await fs.writeFile(path.join(out,'guest05-walk-study.png'),await packCharacterFrames(768,1152,sheetTiles));
await sharp(path.join(out,'guest05-walk-study.png')).resize(192,288).png().toFile(path.join(out,'guest05-walk-study-game.png'));
await sharp(path.join(out,'guest05-walk-study.png')).flatten({background:'#263545'}).png().toFile(path.join(out,'all-directions-dark-review.png'));
await fs.writeFile(path.join(out,'walk-audit.json'),JSON.stringify({runtimeEligible:false,visualApproved:false,status:'incomplete-direction-source-study',directions:audits},null,2)+'\n');
console.log('Directional shared-motion source study rendered; not runtime approved.');
