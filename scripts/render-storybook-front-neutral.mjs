import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from './lib/deterministicSharp.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-05/storybook-body-v1');
const out=path.join(base,'generated'); await fs.mkdir(out,{recursive:true});
const rig=JSON.parse(await fs.readFile(path.join(base,'front-registration.json')));
const skeletonBytes=await fs.readFile(path.resolve(base,rig.skeleton));
const skeleton=JSON.parse(skeletonBytes);
assert.deepEqual(rig.canvas,skeleton.canvas);
assert.equal(rig.headHeight,skeleton.geometry.headHeight);
assert.equal(rig.bodyHeight,skeleton.geometry.bodyHeight);
assert.equal(rig.baseline,skeleton.geometry.baselineY);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const image=(png,w,h)=>`<image width="${w}" height="${h}" href="data:image/png;base64,${png.toString('base64')}"/>`;
const records=[]; const layers=[];
assert.equal(rig.shadow.parent,'root');assert.deepEqual(rig.shadow.pivot,skeleton.bones.root.pivot);
const shadow=(await fs.readFile(path.resolve(base,rig.shadow.source),'utf8')).replace(/<\/?svg[^>]*>/g,'');
const bindings=JSON.parse(await fs.readFile(path.join(base,'front-joint-bindings.json')));
await fs.mkdir(path.join(out,'joint-parts'),{recursive:true});
for(const part of rig.parts){
  assert.ok(skeleton.bones[part.parent],`Unknown parent ${part.parent}`);
  const src=await fs.readFile(path.join(base,`sources/${part.id}-front-${part.version || 'v1'}.png`));
  const mask=await fs.readFile(path.join(base,`masks/${part.id}-front-${part.version || 'v1'}.svg`));
  const {data:rgb,info}=await sharp(src).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {data:alpha,info:mi}=await sharp(mask).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
  assert.equal(mi.width,info.width); assert.equal(mi.height,info.height);
  const rgba=Buffer.alloc(alpha.length*4);
  for(let i=0;i<alpha.length;i++)if(alpha[i]){rgb.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=alpha[i];}
  const clean=await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  await fs.writeFile(path.join(out,`${part.id}.png`),clean);
  let scale=part.scale,angle=0;
  if(part.sourceEnd){const sx=part.sourceEnd[0]-part.sourcePivot[0],sy=part.sourceEnd[1]-part.sourcePivot[1],tx=part.targetEnd[0]-part.pivot[0],ty=part.targetEnd[1]-part.pivot[1];scale=Math.hypot(tx,ty)/Math.hypot(sx,sy);angle=(Math.atan2(ty,tx)-Math.atan2(sy,sx))*180/Math.PI;}
  assert.ok(scale>0);
  const placed=`<g transform="translate(${part.pivot}) rotate(${angle}) scale(${scale}) translate(${-part.sourcePivot[0]} ${-part.sourcePivot[1]})">${image(clean,info.width,info.height)}</g>`;
  await fs.writeFile(path.join(out,`${part.id}-registered.svg`),`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${placed}</svg>`);
  layers.push(placed);
  for(const binding of bindings.parts.filter(b=>b.source===part.id)){
    assert.deepEqual(binding.pivot,skeleton.bones[binding.id].pivot);
    assert.equal(binding.parent,skeleton.bones[binding.id].parent);
    const [x,regionY,width,regionHeight]=binding.region;
    const y=Math.max(0,regionY-bindings.overlapPixels),height=Math.min(288,regionY+regionHeight+bindings.overlapPixels)-y;
    const jointSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><defs><clipPath id="region"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath></defs><g clip-path="url(#region)">${placed}</g></svg>`;
    await fs.writeFile(path.join(out,'joint-parts',`${binding.id}.svg`),jointSvg);
    await sharp(Buffer.from(jointSvg)).png().toFile(path.join(out,'joint-parts',`${binding.id}.png`));
  }
  records.push({id:part.id,parent:part.parent,attachmentOffset:part.pivot.map((n,i)=>n-skeleton.bones[part.parent].pivot[i]),sourceSha256:hash(src),maskSha256:hash(mask),scale,angle,mirrored:false});
}
const head=await fs.readFile(path.join(base,'../storybook-head-matte-v1/generated/complete-head/assembled.png'));
const neck=(await fs.readFile(path.join(base,'neck-front.svg'),'utf8')).replace(/<\/?svg[^>]*>/g,'');
await fs.writeFile(path.join(out,'head-registered.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><g transform="translate(96 126) scale(${72/899}) translate(-735 -1009)">${image(head,1422,1106)}</g></svg>`);
layers.splice(2,0,neck);
layers.unshift(shadow);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288" viewBox="0 0 192 288">${layers.join('')}<g transform="translate(96 126) scale(${72/899}) translate(-735 -1009)">${image(head,1422,1106)}</g></svg>`;
await fs.writeFile(path.join(out,'front-neutral.svg'),svg);
const png=await sharp(Buffer.from(svg)).png().toBuffer();await fs.writeFile(path.join(out,'front-neutral-192x288.png'),png);
for(const w of [96,48])await sharp(png).resize(w,w*1.5).png().toFile(path.join(out,`front-neutral-${w}x${w*1.5}.png`));
const tiles=[];for(const [i,bg] of ['#fff9ee','#c7d7bd','#263545'].entries())tiles.push({input:await sharp(png).resize(384,576).flatten({background:bg}).toBuffer(),left:i*384,top:0});
await sharp({create:{width:1152,height:576,channels:4,background:'#fff9ee'}}).composite(tiles).png().toFile(path.join(out,'background-review.png'));
const reference=await sharp(path.join(base,'../storybook-concept-v1/front-concept.png')).resize({height:576}).toBuffer();
await sharp({create:{width:768,height:576,channels:4,background:'#fff9ee'}}).composite([{input:reference,left:0,top:0},{input:await sharp(png).resize(384,576).toBuffer(),left:384,top:0}]).png().toFile(path.join(out,'reference-comparison.png'));
await fs.writeFile(path.join(out,'audit.json'),JSON.stringify({status:rig.status,runtimeEligible:false,skeletonSha256:hash(skeletonBytes),parts:records,canvas:rig.canvas,limitations:rig.limitations},null,2)+'\n');
console.log('Rendered editable front neutral study; not runtime approved.');
