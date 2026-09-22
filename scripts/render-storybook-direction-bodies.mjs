import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from './lib/deterministicSharp.mjs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {assertPaintedSourceOverlay,paintOriginalSourcePng} from './lib/paintedSourceOverlay.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-05/storybook-directions-v1');
const out=path.join(base,'generated');await fs.mkdir(out,{recursive:true});
const rig=JSON.parse(await fs.readFile(path.join(base,'body-registration.json')));
const skeleton=JSON.parse(await fs.readFile(path.resolve(base,rig.skeleton)));
assert.equal(rig.shadow.parent,'root');assert.deepEqual(rig.shadow.pivot,skeleton.bones.root.pivot);
const shadow=await sharp(path.resolve(base,rig.shadow.source)).png().toBuffer();
const tiles=[],groups={left:[],right:[],back:[]},nearArms={left:[],right:[],back:[]};
for(const [index,p] of rig.parts.entries()){
  assert.ok(skeleton.bones[p.parent]);
  let scale=p.scale,angle=0;
  if(p.sourceEnd){
    const sx=p.sourceEnd[0]-p.sourcePivot[0],sy=p.sourceEnd[1]-p.sourcePivot[1];
    const tx=p.targetEnd[0]-p.pivot[0],ty=p.targetEnd[1]-p.pivot[1];
    scale=Math.hypot(tx,ty)/Math.hypot(sx,sy);
    angle=(Math.atan2(ty,tx)-Math.atan2(sy,sx))*180/Math.PI;
  }
  assert.ok(scale>0);
  const source=p.source||p.id;
  const {data:rgb,info}=await sharp(path.join(base,`sources/${source}-v1.png`)).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {data:a,info:m}=await sharp(path.join(base,`masks/${source}-v1.svg`)).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});assert.equal(info.width,m.width);assert.equal(info.height,m.height);
  const rgba=Buffer.alloc(a.length*4);for(let i=0;i<a.length;i++)if(a[i]){rgb.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=a[i];}
  let clean=await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  for(const file of p.sourceOverlays||[]){const bytes=await fs.readFile(path.resolve(base,file));assertPaintedSourceOverlay(file,bytes,await sharp(bytes).metadata(),info);clean=await paintOriginalSourcePng(clean,bytes);}
  assert.deepEqual(await sharp(clean).extractChannel(3).raw().toBuffer(),a,'Source material must retain original silhouette');
  await fs.writeFile(path.join(out,`${p.id}.png`),clean);
  const placed=`<g transform="translate(${p.pivot}) rotate(${angle}) scale(${scale}) translate(${-p.sourcePivot[0]} ${-p.sourcePivot[1]})"><image width="${info.width}" height="${info.height}" href="data:image/png;base64,${clean.toString('base64')}"/></g>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${placed}</svg>`;await fs.writeFile(path.join(out,`${p.id}-registered.svg`),svg);
  (p.layer==='nearArm'?nearArms:groups)[p.direction].push({input:await sharp(Buffer.from(svg)).png().toBuffer()});
}
for(const [index,direction] of ['left','right','back'].entries()){
  const head=await fs.readFile(path.join(out,`head-${direction}-192x288.png`));
  const neck=await sharp(path.join(base,'neck-skin.svg')).png().toBuffer();
  const png=await sharp({create:{width:192,height:288,channels:4,background:'#00000000'}}).composite([{input:shadow},{input:neck},...groups[direction],...nearArms[direction],{input:head}]).png().toBuffer();await fs.writeFile(path.join(out,`upper-${direction}.png`),png);tiles.push({input:png,left:index*192,top:0});
}
await sharp({create:{width:192*tiles.length,height:288,channels:4,background:'#c7d7bd'}}).composite(tiles).png().toFile(path.join(out,'upper-direction-review.png'));
console.log('Directional garment study rendered; limb integration pending.');
