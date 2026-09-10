import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {alphaBounds216} from './lib/guest216Review.mjs';
import {originalViewport} from './lib/guestOriginalViewport.mjs';
import {renderRigMaterial} from './lib/guestRigMaterial.mjs';

const variant=process.argv[2]||'three-head-216-v1';
assert.match(variant,/^three-head-[a-z0-9-]+$/);
const base=new URL(`../character-assets/rigs/guest-03/${variant}/`,import.meta.url);
const rig=JSON.parse(await readFile(new URL('front-rig.json',base)));
const skeleton=JSON.parse(await readFile(new URL(rig.skeleton,base)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const textures={},sources=[];
assert.deepEqual(skeleton.canvas,[192,288]);
assert.equal(skeleton.geometry.headHeight*3,skeleton.geometry.characterHeight);
assert.equal(skeleton.geometry.bodyHeight,skeleton.geometry.headHeight*2);
for(const [name,p] of Object.entries(rig.parts)){
  assert.equal(p.mirrored,false);
  assert.deepEqual(p.pivot,skeleton.bones[p.parent].pivot);
  assert.ok(!/\/(generated|review|animation)\//.test(p.file),'Editable original part required');
  const bytes=await readFile(new URL(p.file,base)),meta=await sharp(bytes).metadata();
  assert.equal(meta.hasAlpha,true);
  const [x,y,w,h]=p.rect;
  const uri=`data:${p.file.endsWith('.svg')?'image/svg+xml':'image/png'};base64,${bytes.toString('base64')}`;
  textures[name]=p.sourceViewport
    ? `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${originalViewport(p,meta).viewport.join(' ')}" preserveAspectRatio="none"><image href="${uri}" width="${meta.width}" height="${meta.height}"/></svg>`
    : `<image href="${uri}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"${p.fadeBottom?' mask="url(#torso-fade)"':''}/>`;
  if(p.sourceViewport&&p.fadeBottom)textures[name]=`<g mask="url(#torso-fade)">${textures[name]}</g>`;
  textures[name]=renderRigMaterial(textures[name],p.material,name);
  sources.push({name,file:p.file,sha256:hash(bytes),parent:p.parent,pivot:p.pivot,rect:p.rect,...(p.material?{material:p.material}:{}),...(p.sourceViewport?{sourceViewport:p.sourceViewport}:{})});
}
const [tx,ty,tw]=rig.parts.torsoShell.rect,[visible,fade]=rig.parts.torsoShell.fadeBottom;
const defs=`<defs><linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="${ty+visible-fade}" x2="0" y2="${ty+visible}"><stop stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="torso-fade" maskUnits="userSpaceOnUse" x="${tx}" y="${ty}" width="${tw}" height="${visible}"><rect x="${tx}" y="${ty}" width="${tw}" height="${visible}" fill="url(#fade)"/></mask></defs>`;
const wrap=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${defs}${body}</svg>`;
function chain(name,pose){const b=skeleton.bones[name];return(b.parent?chain(b.parent,pose):'')+` rotate(${pose.rotations[name]||0} ${b.pivot.join(' ')})`;}
function limb(side,names,pose){
  const leg=['thigh','calf','shoe'].includes(names[0]),part=textures[`${leg?'leg':'arm'}${side}Skin`],depth=leg?(pose.depth[side]||0):0;
  if(names.length===3&&names.every(n=>!pose.rotations[n+side]))return `<g transform="translate(0 ${depth})">${part}</g>`;
  return names.map(n=>{const[y,h]=rig.regions[n],id=n+side;return `<defs><clipPath id="${id}"><rect y="${y}" width="192" height="${h}"/></clipPath></defs><g transform="translate(0 ${depth}) ${chain(id,pose)}"><g clip-path="url(#${id})">${part}</g></g>`;}).join('');
}
function bounds(data,info){let left=192,top=288,right=-1,bottom=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return right<0?null:{left,top,right,bottom,width:right-left+1,height:bottom-top+1};}
const head=textures.backHair+textures.face+textures.frontHair;
const headRaw=await sharp(Buffer.from(wrap(head))).raw().toBuffer({resolveWithObject:true});
const output=new URL('generated/front/',base);await mkdir(output,{recursive:true});
const frames=[],measurements=[];
for(const [i,pose] of rig.frames.entries()){
  const order=pose.forward==='Right'?['Left','Right']:['Right','Left'];
  const legs=order.map(side=>limb(side,['thigh','calf','shoe'],pose)).join('');
  const arms=['Right','Left'].map(side=>limb(side,['upperArm','forearm','hand'],pose)).join('');
  const body=textures.backHair+`<defs><clipPath id="pelvis"><rect y="${rig.legOcclusion.top}" width="192" height="${288-rig.legOcclusion.top}"/></clipPath></defs><g clip-path="url(#pelvis)">${legs}</g>`+textures.neckCollar+arms+textures.torsoShell+textures.neckSkin+textures.face+textures.frontHair;
  const svg=wrap(textures.shadow+body),png=await sharp(Buffer.from(svg)).png().toBuffer();
  const raw=await sharp(Buffer.from(wrap(body))).raw().toBuffer({resolveWithObject:true});
  const feet={};for(const side of ['Left','Right'])feet[side]=await alphaBounds216(wrap(limb(side,['shoe'],pose)));
  frames.push(png);measurements.push({frame:i+1,sha256:hash(png),silhouette:bounds(raw.data,raw.info),forward:pose.forward,feet});
  await writeFile(new URL(`frame-${i+1}.svg`,output),svg);
  await writeFile(new URL(`frame-${i+1}.png`,output),png);
}
assert.deepEqual(frames[1],frames[3]);assert.notDeepEqual(frames[0],frames[2]);
for(const [name,background] of [['light','#eee8de'],['dark','#29313a']]){
  await sharp({create:{width:768,height:288,channels:4,background}}).composite(frames.map((input,i)=>({input,left:i*192,top:0}))).png().toFile(fileURLToPath(new URL(`review-${name}.png`,output)));
}
const manifest={status:'candidate-not-verified',runtimeEnabled:false,geometry:skeleton.geometry,headOpaqueBounds:bounds(headRaw.data,headRaw.info),alphaThreshold:128,sources,frames:measurements};
await writeFile(new URL('manifest.json',output),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({geometry:manifest.geometry,headOpaqueBounds:manifest.headOpaqueBounds,frames:measurements},null,2));
