import{readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import assert from'node:assert/strict';
import{svg216,write216Review}from'./lib/guest216Review.mjs';
const direction=process.argv[2]||'left';assert.ok(['left','right'].includes(direction));
const base=new URL('../character-assets/rigs/guest-03/three-head-216-v1/',import.meta.url);
const rig=JSON.parse(await readFile(new URL(`${direction}-rig.json`,base)));
const skeleton=JSON.parse(await readFile(new URL(rig.skeleton,base)));
rig.bones=skeleton.projections[rig.skeletonProjection].bones;
const sources=[];
async function load(file){assert.ok(!/\/(generated|review|animation)\//.test(file));const bytes=await readFile(new URL(file,base));sources.push({file,sha256:createHash('sha256').update(bytes).digest('hex')});return`data:image/png;base64,${bytes.toString('base64')}`;}
const bodyURI=await load(rig.sourceBody.file),headURI=await load(rig.head.file);
const textures={};for(const [name,p]of Object.entries(rig.parts)){const[x,y,w,h]=p.rect;textures[name]=`<image href="${await load(p.file)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;}
const source=rig.sourceBody,mapping=rig.sourceGeometryMapping;
const transform=`translate(${mapping.translate.join(' ')}) scale(${mapping.scale.join(' ')})`;
const art=`<image href="${bodyURI}" width="${source.size[0]}" height="${source.size[1]}"/>`;
const[cx,cy,cw,ch]=source.clip;
const sourceDefs=`<clipPath id="source"><rect x="${cx}" y="${cy}" width="${cw}" height="${ch}"/></clipPath><mask id="body" maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024"><rect width="1536" height="1024" fill="white"/><path d="${source.armMask}" fill="black"/></mask>`;
const shell=`<g transform="${transform}"><defs>${sourceDefs}</defs><g clip-path="url(#source)" mask="url(#body)">${art}</g></g>`;
const joint=rig.hiddenShoulder,jm=joint.legacyPathMapping;
const hidden=`<defs><filter id="alpha-white"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter><mask id="silhouette" maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="288"><g transform="${transform}" filter="url(#alpha-white)" clip-path="url(#source)">${art}</g></mask><linearGradient id="joint" x1="0" y1="110" x2="0" y2="174" gradientUnits="userSpaceOnUse"><stop stop-color="${joint.topColor}"/><stop offset="1" stop-color="${joint.bottomColor}"/></linearGradient></defs><g mask="url(#silhouette)"><g transform="translate(${jm.translate.join(' ')}) scale(${jm.scale.join(' ')})"><path d="${joint.path}" fill="url(#joint)"/></g></g>`;
const h=rig.head,[hx,hy,,hh]=h.sourceBounds,[hx0,hy0,hw0,hh0]=h.sourceClip;
assert.equal(h.height,skeleton.geometry.headHeight);assert.equal(h.mirrored,false);
const head=`<g transform="translate(${h.position.join(' ')}) scale(${h.height/hh}) translate(${-hx} ${-hy})"><defs><clipPath id="head"><rect x="${hx0}" y="${hy0}" width="${hw0}" height="${hh0}"/></clipPath></defs><image href="${headURI}" width="${h.size[0]}" height="${h.size[1]}" clip-path="url(#head)"/></g>`;
function chain(n,p){const b=rig.bones[n],angle=n==='root'?0:(p[n]||0);assert.equal(typeof angle,'number');return(b.parent?chain(b.parent,p):'')+` rotate(${angle} ${b.pivot.join(' ')})`;}
function arm(segment){const[y,height]=source.armRegions[segment];return`<g transform="${transform}"><defs><clipPath id="arm-${segment}"><path d="${source.armMask}"/></clipPath><clipPath id="range-${segment}"><rect x="${cx}" y="${y}" width="${cw}" height="${height}"/></clipPath></defs><g clip-path="url(#arm-${segment})"><g clip-path="url(#range-${segment})">${art}</g></g></g>`;}
function leg(side,segment){const[y,height]=rig.legRegions[segment],id=segment+side;return`<defs><clipPath id="${id}"><rect y="${y}" width="192" height="${height}"/></clipPath></defs><g clip-path="url(#${id})">${textures['leg'+side+'Skin']}</g>`;}
const documents=[];
for(const p of rig.frames){
 assert.deepEqual(p.root||[0,0],[0,0],'Root must remain fixed; root translation is not a joint angle');
 let body='';for(const side of rig.nearSide==='Right'?['Left','Right']:['Right','Left'])for(const segment of['thigh','calf','shoe'])body+=`<g transform="translate(0 ${p.ground[side]||0}) ${chain(segment+side,p)}">${leg(side,segment)}</g>`;
 body+=textures.neck+textures.torsoShell+hidden+shell;
 for(const segment of['upperArm','forearm','hand'])body+=`<g transform="${chain(segment+rig.nearSide,p)}">${arm(segment)}</g>`;
 const feet=Object.fromEntries(['Left','Right'].map(side=>[side,`<g transform="translate(0 ${p.ground[side]||0}) ${chain('shoe'+side,p)}">${leg(side,'shoe')}</g>`]));
 body+=head;documents.push({body,feet,forward:p.forward||null,svg:svg216('<ellipse cx="96" cy="267" rx="30" ry="3" fill="#172033" opacity=".18"/>'+body)});
}
await write216Review(base,direction,documents,head,sources,{geometry:skeleton.geometry});
