import{readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import assert from'node:assert/strict';
import{svg216,write216Review}from'./lib/guest216Review.mjs';
const base=new URL('../character-assets/rigs/guest-03/three-head-216-v1/',import.meta.url);
const rig=JSON.parse(await readFile(new URL('back-rig.json',base))),skeleton=JSON.parse(await readFile(new URL(rig.skeleton,base))),sources=[];
rig.bones=skeleton.projections[rig.skeletonProjection].bones;
async function load(file){assert.ok(!/\/(generated|review)\//.test(file));const b=await readFile(new URL(file,base));sources.push({file,sha256:createHash('sha256').update(b).digest('hex')});return`data:image/png;base64,${b.toString('base64')}`;}
async function mapped(p){const[x,y,w,h]=p.rect,uv=p.sourceViewport,uri=await load(p.file);return uv?`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${uv.join(' ')}" preserveAspectRatio="none"><image href="${uri}" width="${p.size[0]}" height="${p.size[1]}"/></svg>`:`<image href="${uri}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;}
const head=await mapped(rig.head),hidden=await mapped(rig.hiddenTorso),parts={};
for(const[n,p]of Object.entries(rig.parts))parts[n]=await mapped(p);
const source=rig.sourceBody,uri=await load(source.file),m=rig.sourceGeometryMapping;
const art=`<image href="${uri}" width="${source.size[0]}" height="${source.size[1]}"/>`,transform=`translate(${m.translate.join(' ')}) scale(${m.scale.join(' ')})`;
const masks=`<defs><mask id="body" maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024"><rect width="1536" height="1024" fill="white"/>${Object.values(source.armMasks).map(d=>`<path d="${d}" fill="black"/>`).join('')}</mask><filter id="alpha-white"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter><mask id="silhouette" maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="288"><g transform="${transform}" filter="url(#alpha-white)">${art}</g></mask></defs>`;
const shell=`<g transform="${transform}"><g mask="url(#body)">${art}</g></g>`;
function chain(n,p){const b=rig.bones[n];return(b.parent?chain(b.parent,p):'')+` rotate(${p[n]||0} ${b.pivot.join(' ')})`;}
function arm(side,n){const r=source.armRegions[n],id=side+n;return`<g transform="${transform}"><defs><clipPath id="${id}-arm"><path d="${source.armMasks[side]}"/></clipPath><clipPath id="${id}-range"><rect y="${r.sourceY}" width="1536" height="${r.sourceHeight}"/></clipPath></defs><g clip-path="url(#${id}-arm)"><g clip-path="url(#${id}-range)">${art}</g></g></g>`;}
function leg(side,n){const[y,h]=rig.legRegions[n],id=side+n;return`<defs><clipPath id="${id}"><rect y="${y}" width="192" height="${h}"/></clipPath></defs><g clip-path="url(#${id})">${parts['leg'+side+'Skin']}</g>`;}
const documents=[];
for(const p of rig.frames){
 let body=masks+`<defs><clipPath id="pelvis"><rect y="${rig.legOcclusionTop}" width="192" height="${288-rig.legOcclusionTop}"/></clipPath></defs><g clip-path="url(#pelvis)">`;
 for(const side of p.forward==='Right'?['Right','Left']:['Left','Right']){
  const pose=Object.fromEntries(['thigh','calf','shoe'].map(n=>[n+side,p.legs[side][n]||0]));
  for(const n of['thigh','calf','shoe'])body+=`<g transform="translate(0 ${p.legs[side].depthY||0}) ${chain(n+side,pose)}">${leg(side,n)}</g>`;
 }
 body+='</g>'+parts.neck+`<g mask="url(#silhouette)">${hidden}</g>`;
 for(const side of['Left','Right'])for(const n of['upperArm','forearm','hand'])body+=`<g transform="${chain(n+side,p)}">${arm(side,n)}</g>`;
 const feet=Object.fromEntries(['Left','Right'].map(side=>{const pose=Object.fromEntries(['thigh','calf','shoe'].map(n=>[n+side,p.legs[side][n]||0]));return[side,`<g transform="translate(0 ${p.legs[side].depthY||0}) ${chain('shoe'+side,pose)}">${leg(side,'shoe')}</g>`];}));
 body+=shell+head;documents.push({body,feet,forward:p.forward,svg:svg216('<ellipse cx="96" cy="267" rx="30" ry="3" fill="#172033" opacity=".18"/>'+body)});
}
await write216Review(base,'back',documents,head,sources,{geometry:skeleton.geometry});
