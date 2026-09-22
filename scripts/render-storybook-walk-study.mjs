import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {packCharacterFrames} from './lib/packCharacterFrames.mjs';
import {beginPaintedRender,finishPaintedRender} from './lib/paintedRenderReceipt.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id=process.argv[2];assert.match(id||'',/^guest-\d{2}$/);
const base=path.join(root,'character-assets/rigs',id,'storybook-source-v1'),out=path.join(base,'generated');
const rig=JSON.parse(await fs.readFile(path.join(base,'body-registration.json')));
const headRig=JSON.parse(await fs.readFile(path.join(base,'head-registration.json')));
const common=path.dirname(path.resolve(base,rig.skeleton));
const skeleton=JSON.parse(await fs.readFile(path.resolve(base,rig.skeleton)));
const layout=JSON.parse(await fs.readFile(path.join(common,'painted-joint-regions-v1.json')));
const contact=rig.contactAnimation?JSON.parse(await fs.readFile(path.join(common,rig.contactAnimation))):null;
const cloth=rig.clothAnimation?JSON.parse(await fs.readFile(path.join(common,rig.clothAnimation))):null;
const legVisibility=rig.legVisibility;
if(legVisibility){
  assert.equal(legVisibility.parent,'pelvis','Garment visibility belongs to the costume, not a moving foot');
  assert.match(legVisibility.source,/\.svg$/,'Garment visibility must be editable vector source');
  const bytes=await fs.readFile(path.resolve(base,legVisibility.source));
  assert.ok(!/<(?:image|foreignObject|script)\b|\b(?:href|xlink:href)\s*=/i.test(bytes.toString()),'Visibility cannot embed raster repairs');
  const m=await sharp(bytes).metadata();assert.equal(m.width,192);assert.equal(m.height,288);
}
if(cloth){assert.equal(cloth.parent,'pelvis');assert.equal(cloth.pivot.length,2);assert.ok(cloth.pivot.every(Number.isFinite));}
const image=async file=>`<image width="192" height="288" href="data:image/svg+xml;base64,${(await fs.readFile(file)).toString('base64')}"/>`;
const directions=rig.walkDirections||[...new Set(rig.parts.map(p=>p.direction))],tiles=[],audits=[];
assert.ok(directions.length>0,'No complete limb directions registered; cannot render walking sheet yet');
const receipt=await beginPaintedRender(root,[
  'scripts/render-storybook-walk-study.mjs','scripts/lib/packCharacterFrames.mjs','scripts/lib/paintedRenderReceipt.mjs','pnpm-lock.yaml',
  path.join(base,'body-registration.json'),path.join(base,'head-registration.json'),path.resolve(base,rig.skeleton),
  path.join(common,'painted-joint-regions-v1.json'),
  ...rig.parts.flatMap(p=>Object.values(p.jointMasks||{})).map(file=>path.resolve(base,file)),
  ...[legVisibility?.source].filter(Boolean).map(file=>path.resolve(base,file)),
  ...[rig.contactAnimation,rig.clothAnimation].filter(Boolean).map(file=>path.join(common,file)),
  ...directions.map(direction=>path.join(common,`animations/${rig.family}-${direction}.json`))
],[path.join(out,'head-render-receipt.json'),path.join(out,'body-render-receipt.json')]);
for(const [row,direction] of directions.entries()){
  const bones=direction==='front'?skeleton.bones:skeleton.projections[direction].bones;
  const motion=JSON.parse(await fs.readFile(path.join(common,`animations/${rig.family}-${direction}.json`)));
  for(const [index,depth] of Object.entries(contact?.directions[direction]||{}))Object.assign(motion.frames[index].depth,depth);
  const parts=rig.parts.filter(p=>p.direction===direction).sort((a,b)=>(a.layer==='nearArm'?1:0)-(b.layer==='nearArm'?1:0)),joints=new Map(),bindings=[];
  if(cloth){const keys=cloth.directions[direction];assert.equal(keys?.length,4);assert.ok(keys.every(Number.isFinite));assert.equal(keys[1],0);assert.equal(keys[3],0);assert.equal(keys[0],-keys[2]);}
  const chain=id=>{const result=[];for(let p=id;p;p=bones[p].parent)result.unshift(p);return result;};
  const transform=(id,frame)=>chain(id).map(b=>{const [x,y]=bones[b].pivot;return `translate(${x} ${y}) rotate(${frame.rotations[b]||0}) translate(${-x} ${-y})`;}).join(' ');
  for(const p of parts){
    const kind=p.parent.startsWith('thigh')?'leg':p.parent.startsWith('upperArm')?'arm':null;if(!kind)continue;
    const side=p.parent.endsWith('Left')?'Left':'Right',materials=[];
    if(p.jointMasks)assert.deepEqual(Object.keys(p.jointMasks).sort(),layout[kind].map(([name])=>name).sort(),'Every joint must have an explicit source mask');
    for(const [name,start,end] of layout[kind]){
      const id=name+side,y=Math.max(0,start-layout.overlap),bottom=Math.min(288,end+layout.overlap);
      let boundary=`<clipPath id="joint"><rect x="0" y="${y}" width="192" height="${bottom-y}"/></clipPath>`,attribute='clip-path';
      if(p.jointMasks){
        const file=path.resolve(base,p.jointMasks[name]),bytes=await fs.readFile(file);
        assert.ok(file.startsWith(base+path.sep)&&file.endsWith('.svg'),'Joint masks must be local editable SVG sources');
        assert.ok(!/<(?:image|foreignObject|script)\b|\b(?:href|xlink:href)\s*=/i.test(bytes.toString()),'Joint masks cannot contain raster repairs or external resources');
        const meta=await sharp(bytes).metadata();assert.equal(meta.width,192);assert.equal(meta.height,288);
        boundary=`<mask id="joint" maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="288">${await image(file)}</mask>`;attribute='mask';
      }
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><defs>${boundary}</defs><g ${attribute}="url(#joint)">${await image(path.join(out,`${p.id}-registered.svg`))}</g></svg>`;
      const file=path.join(out,`${direction}-${id}-source.svg`);await fs.writeFile(file,svg);
      materials.push({id,side,kind,image:await image(file)});bindings.push({id,parent:bones[id].parent,pivot:bones[id].pivot,source:p.id,region:p.jointMasks?null:[start,end],overlap:p.jointMasks?null:layout.overlap,...(p.jointMasks?{sourceMask:p.jointMasks[name]}:{})});
    }
    joints.set(p.id,materials);
  }
  assert.equal(bindings.length,12,`${direction}: incomplete limb sources cannot enter walk output`);
  await fs.writeFile(path.join(out,`${direction}-joint-bindings.json`),JSON.stringify({parts:bindings,layout:layout.id},null,2)+'\n');
  const frames=[];
  for(const [column,frame] of motion.frames.entries()){
    const layers=headRig.splitBodyOcclusion?[await image(path.join(out,`head-${direction}-behind-body.svg`))]:[];
    for(const p of parts){
      if(joints.has(p.id))for(const j of joints.get(p.id)){
        const limb=`<g transform="translate(0 ${j.kind==='leg'?(frame.depth[j.side]||0):0}) ${transform(j.id,frame)}">${j.image}</g>`;
        layers.push(legVisibility&&j.kind==='leg'?`<g mask="url(#costume-leg-visibility)">${limb}</g>`:limb);
      }
      else {
        let clothTransform='';
        if(cloth&&p.id.startsWith('skirt-')){
          assert.equal(p.parent,cloth.parent);
          const [x,y]=cloth.pivot;
          clothTransform=` translate(${x} ${y}) rotate(${cloth.directions[direction][column]}) translate(${-x} ${-y})`;
        }
        layers.push(`<g transform="${transform(p.parent,frame)}${clothTransform}">${await image(path.join(out,`${p.id}-registered.svg`))}</g>`);
      }
    }
    layers.push(await image(path.join(out,headRig.splitBodyOcclusion?`head-${direction}-above-body.svg`:`head-${direction}-registered.svg`)));
    const visibility=legVisibility?`<defs><mask id="costume-leg-visibility" maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="288"><g transform="${transform(legVisibility.parent,frame)}">${await image(path.resolve(base,legVisibility.source))}</g></mask></defs>`:'';
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${visibility}${layers.join('')}</svg>`;
    await fs.writeFile(path.join(out,`${direction}-walk-${column+1}.svg`),svg);
    const png=await sharp(Buffer.from(svg)).png().toBuffer();frames.push(png);await fs.writeFile(path.join(out,`${direction}-walk-${column+1}.png`),png);tiles.push({input:png,left:column*192,top:row*288});
  }
  assert.deepEqual(frames[1],frames[3]);assert.notDeepEqual(frames[0],frames[2]);
  audits.push({direction,motion:motion.id,contact:contact?.id||null,cloth:cloth?{id:cloth.id,parent:cloth.parent,pivot:cloth.pivot,rotations:cloth.directions[direction]}:null,forward:motion.frames.map(f=>f.forward),jointCount:bindings.length,neutralIdentical:true});
}
await fs.writeFile(path.join(out,'walk-study.png'),await packCharacterFrames(768,directions.length*288,tiles));
await sharp(path.join(out,'walk-study.png')).flatten({background:'#263545'}).png().toFile(path.join(out,'walk-dark-review.png'));
// Deliberate whole-sheet downsampling only. Never rescale isolated frame regions.
for(const [label,width] of [['selection',384],['game',192]])await sharp(path.join(out,'walk-study.png')).resize(width,directions.length*width*288/768).png().toFile(path.join(out,`walk-study-${label}.png`));
const outputHashes={};for(const file of ['walk-study.png','walk-study-selection.png','walk-study-game.png'])outputHashes[file]=crypto.createHash('sha256').update(await fs.readFile(path.join(out,file))).digest('hex');
await fs.writeFile(path.join(out,'walk-audit.json'),JSON.stringify({id,directions:audits,outputHashes,runtimeEligible:false,visualApproved:false},null,2)+'\n');
await finishPaintedRender(root,path.join(out,'walk-render-receipt.json'),receipt,[
  ...Object.keys(outputHashes).map(file=>path.join(out,file)),
  ...directions.flatMap(direction=>[1,2,3,4].map(frame=>path.join(out,`${direction}-walk-${frame}.png`)))
]);
console.log(`${id}: shared ${rig.family} motion rendered in ${directions.length} directions; not runtime approved.`);
