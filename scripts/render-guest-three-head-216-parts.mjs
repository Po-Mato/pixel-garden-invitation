import{readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import assert from'node:assert/strict';
import sharp from'sharp';
import{originalViewport}from'./lib/guestOriginalViewport.mjs';
import{renderRigMaterial}from'./lib/guestRigMaterial.mjs';
import{svg216,write216Review,alphaBounds216}from'./lib/guest216Review.mjs';
const id=process.argv[2],direction=process.argv[3];
assert.match(id||'',/^guest-(01|02|04|05|06|07|08|09|10|11|12)$/);assert.ok(['front','left','right','back'].includes(direction));
const base=new URL(`../character-assets/rigs/${id}/three-head-216-v1/`,import.meta.url);
const rig=JSON.parse(await readFile(new URL(`${direction}-rig.json`,base))),skeleton=JSON.parse(await readFile(new URL(rig.skeleton,base)));
const animation=JSON.parse(await readFile(new URL(rig.animation,base)));assert.equal(animation.direction,direction);
rig.frames=animation.frames;rig.regions=animation.regions;
if(animation.garmentAnimation)rig.garmentAnimation=animation.garmentAnimation;
const bones=rig.skeletonProjection?skeleton.projections[rig.skeletonProjection].bones:skeleton.bones;
const textures={},sources=[];
for(const[name,p]of Object.entries(rig.parts)){
 assert.equal(p.mirrored,false);assert.deepEqual(p.pivot,bones[p.parent].pivot);assert.ok(!/\/(generated|review)\//.test(p.file));
 const b=await readFile(new URL(p.file,base)),sha256=createHash('sha256').update(b).digest('hex');if(p.sha256)assert.equal(sha256,p.sha256);
 const meta=await sharp(b).metadata();assert.equal(meta.hasAlpha,true);
 const registration=originalViewport(p,meta),[x,y,w,h]=p.rect;
 textures[name]=`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${registration.viewport.join(' ')}" preserveAspectRatio="none"><image href="data:${p.file.endsWith('.svg')?'image/svg+xml':'image/png'};base64,${b.toString('base64')}" width="${meta.width}" height="${meta.height}"/></svg>`;
 textures[name]=renderRigMaterial(textures[name],p.material,name);
 sources.push({name,file:p.file,sha256,parent:p.parent,pivot:p.pivot,rect:p.rect,sourceViewport:registration.viewport,material:p.material||null});
 if(p.fadeBottom){const[end,fade]=p.fadeBottom,hem=y+end; textures[name]=`<defs><linearGradient id="hem-fade" gradientUnits="userSpaceOnUse" x1="0" y1="${hem-fade}" x2="0" y2="${hem}"><stop stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="hem-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="288"><rect width="192" height="${hem}" fill="url(#hem-fade)"/></mask></defs><g mask="url(#hem-mask)">${textures[name]}</g>`;}
}
function chain(n,p){const b=bones[n],angle=p.rotations[n]||0;assert.equal(typeof angle,'number');return(b.parent?chain(b.parent,p):'')+` rotate(${angle} ${b.pivot.join(' ')})`;}
function limb(name,p,onlyShoe=false){
 const side=name.includes('Left')?'Left':'Right',leg=name.startsWith('leg'),names=onlyShoe?['shoe']:leg?['thigh','calf','shoe']:['upperArm','forearm','hand'];
 const depth=leg?(p.depth[side]||0):0;
 if(!onlyShoe&&names.every(n=>!p.rotations[n+side]))return`<g transform="translate(0 ${depth})">${textures[name]}</g>`;
 return names.map(n=>{const[y,h]=rig.regions[n],id=n+side;return`<defs><clipPath id="${id}"><rect y="${y}" width="192" height="${h}"/></clipPath></defs><g transform="translate(0 ${depth}) ${chain(id,p)}"><g clip-path="url(#${id})">${textures[name]}</g></g>`;}).join('');
}
const head=Object.keys(rig.parts).filter(n=>rig.parts[n].parent==='head').map(n=>textures[n]).join(''),documents=[];
for(const[i,p]of rig.frames.entries()){
 let body='';for(const name of rig.drawOrder){
  if(name==='shadow')continue;
  if(/^(arm|leg)/.test(name)){const part=limb(name,p);body+=name.startsWith('leg')&&rig.legOcclusionTop!==undefined?`<defs><clipPath id="pelvis"><rect y="${rig.legOcclusionTop}" width="192" height="${288-rig.legOcclusionTop}"/></clipPath></defs><g clip-path="url(#pelvis)">${part}</g>`:part;continue;}
  const attachment=rig.clothingAttachments.find(a=>a.part===name);
  const a=name==='skirt'?rig.garmentAnimation:name==='handbag'?rig.accessoryAnimation:attachment;
  if(a){const parent=name==='skirt'?'':chain(a.parent,p);body+=`<g transform="${parent} rotate(${a.frames[i].rotate||0} ${a.pivot.join(' ')})">${textures[name]}</g>`;}
  else body+=textures[name];
 }
 const feet=Object.fromEntries(['Left','Right'].map(side=>[side,limb('leg'+side+'Skin',p,true)]));
 documents.push({body,feet,forward:p.forward,svg:svg216(textures.shadow+body)});
}
let cranialHead=head;
if(rig.headMeasurement){
 const [x,y,w,h]=rig.headMeasurement.region;
 assert.deepEqual([x,y,w,h],[0,skeleton.geometry.headTop,192,skeleton.geometry.headHeight]);
 cranialHead=`<defs><clipPath id="cranial-measurement"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#cranial-measurement)">${head}</g>`;
}
await write216Review(base,direction,documents,cranialHead,sources,{characterId:id,geometry:skeleton.geometry,asymmetry:rig.asymmetry,clothingAttachments:rig.clothingAttachments,headMeasurement:rig.headMeasurement||null,completeHeadArtworkBounds:await alphaBounds216(svg216(head))});
