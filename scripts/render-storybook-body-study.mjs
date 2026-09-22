import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from './lib/deterministicSharp.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {assertSourceMatteCoverage} from './storybook-source-matte-contract.mjs';
import {assertPaintedSourceOverlay,paintOriginalSourcePng} from './lib/paintedSourceOverlay.mjs';
import {sourceVolumeBinding} from './lib/storybookSourceVolume.mjs';
import {beginPaintedRender,finishPaintedRender} from './lib/paintedRenderReceipt.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id=process.argv[2];assert.match(id||'',/^guest-\d{2}$/);
const base=path.join(root,'character-assets/rigs',id,'storybook-source-v1');
const rig=JSON.parse(await fs.readFile(path.join(base,'body-registration.json')));
const headRig=JSON.parse(await fs.readFile(path.join(base,'head-registration.json')));
const receipt=await beginPaintedRender(root,[
  'scripts/render-storybook-body-study.mjs','scripts/lib/paintedSourceOverlay.mjs',
  'scripts/lib/storybookSourceVolume.mjs',
  'scripts/storybook-source-matte-contract.mjs','scripts/lib/paintedRenderReceipt.mjs','pnpm-lock.yaml',
  path.join(base,'body-registration.json'),path.join(base,'head-registration.json'),path.resolve(base,rig.skeleton),
  ...rig.parts.flatMap(p=>[p.vector,p.source,p.matte,...(p.sourceOverlays||[])].filter(Boolean).map(file=>path.resolve(base,file)))
]);
const skeleton=JSON.parse(await fs.readFile(path.resolve(base,rig.skeleton)));
assert.deepEqual(skeleton.canvas,[192,288]);assert.equal(skeleton.geometry.characterHeight,216);
if(rig.sourceSamplesPerOutputPixel!==undefined)assert.ok(Number.isFinite(rig.sourceSamplesPerOutputPixel)&&rig.sourceSamplesPerOutputPixel>=1&&rig.sourceSamplesPerOutputPixel<=8,'Invalid source sampling density');
const out=path.join(base,'generated');await fs.mkdir(out,{recursive:true});
const groups=new Map(),audit=[];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
// Explicit source-layer ownership: far limbs stay behind the costume shell;
// near limbs remain visible without cutting holes into the rendered torso.
const orderedParts=[...rig.parts].sort((a,b)=>(a.layer==='nearArm'?1:0)-(b.layer==='nearArm'?1:0));
for(const p of orderedParts){
  const bones=p.direction==='front'?skeleton.bones:skeleton.projections[p.direction].bones;
  assert.ok(bones[p.parent]);assert.notEqual(p.mirrored,true);
  if(p.vector){
    assert.deepEqual(p.pivot,bones[p.parent].pivot);
    const svg=await fs.readFile(path.resolve(base,p.vector));
    const metadata=await sharp(svg).metadata();assert.equal(metadata.width,192);assert.equal(metadata.height,288);
    await fs.writeFile(path.join(out,`${p.id}-registered.svg`),svg);
    if(!groups.has(p.direction))groups.set(p.direction,[]);
    groups.get(p.direction).push({input:await sharp(svg).png().toBuffer()});
    audit.push({id:p.id,parent:p.parent,pivot:p.pivot,vector:p.vector,sourceSha256:hash(svg),mirrored:false});continue;
  }
  const {data:rgb,info}=await sharp(path.join(base,p.source)).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {data:a,info:m}=await sharp(path.join(base,p.matte)).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,m.width);assert.equal(info.height,m.height);
  assertSourceMatteCoverage(a,m.width,m.height,`${id} ${p.id}`);
  const rgba=Buffer.alloc(a.length*4);for(let i=0;i<a.length;i++)if(a[i]){rgb.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=a[i];}
  let clean=await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  const sourceOverlays=[];
  assert.ok(p.sourceOverlays===undefined||Array.isArray(p.sourceOverlays),'Source overlays must be an explicit list');
  for(const file of p.sourceOverlays||[]){
    const bytes=await fs.readFile(path.resolve(base,file));
    const metadata=await sharp(bytes).metadata();
    assertPaintedSourceOverlay(file,bytes,metadata,info);
    // Editable source art layers, before registration and shared animation.
    // Source-atop preserves the original silhouette and transparent background.
    clean=await paintOriginalSourcePng(clean,bytes);
    sourceOverlays.push({file,sha256:hash(bytes),blend:'source-atop'});
  }
  await fs.writeFile(path.join(out,`${p.id}.png`),clean);
  let scale=p.scale,angle=0;
  if(p.sourceEnd){
    const source=[p.sourceEnd[0]-p.sourcePivot[0],p.sourceEnd[1]-p.sourcePivot[1]],target=[p.targetEnd[0]-p.pivot[0],p.targetEnd[1]-p.pivot[1]];
    scale=Math.hypot(...target)/Math.hypot(...source);angle=(Math.atan2(target[1],target[0])-Math.atan2(source[1],source[0]))*180/Math.PI;
  }
  assert.ok(scale>0);
  // Cairo's SVG image sampling aliases fine source ink when a 2000px part is
  // reduced to a 45px limb. Prefilter the complete source layer before its
  // geometric transform; original source units, pivot and scale stay intact.
  // This is a render mipmap, never a repair of pixels in a finished frame.
  const sampleScale=rig.sourceSamplesPerOutputPixel?Math.min(1,scale*rig.sourceSamplesPerOutputPixel):1;
  const sampled=sampleScale<1?await sharp(clean).resize(Math.max(1,Math.round(info.width*sampleScale)),Math.max(1,Math.round(info.height*sampleScale)),{fit:'fill',kernel:'lanczos3'}).png().toBuffer():clean;
  const volume=sourceVolumeBinding(p,rig.sourceVolume);
  const material=`<g transform="translate(${p.pivot}) rotate(${angle}) scale(${scale}) translate(${-p.sourcePivot[0]} ${-p.sourcePivot[1]})"><image width="${info.width}" height="${info.height}" href="data:image/png;base64,${sampled.toString('base64')}"/></g>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${volume.transform?`<g transform="${volume.transform}">${material}</g>`:material}</svg>`;
  await fs.writeFile(path.join(out,`${p.id}-registered.svg`),svg);
  if(!groups.has(p.direction))groups.set(p.direction,[]);
  groups.get(p.direction).push({input:await sharp(Buffer.from(svg)).png().toBuffer()});
  audit.push({id:p.id,parent:p.parent,pivot:p.pivot,sourcePivot:p.sourcePivot,scale,angle,sourceOverlays,sourceVolume:volume,sourceSampling:{units:[info.width,info.height],sampleScale,method:sampleScale<1?'whole-source-lanczos3-prefilter':'native'},sourceSha256:hash(await fs.readFile(path.join(base,p.source))),matteSha256:hash(await fs.readFile(path.join(base,p.matte))),mirrored:false});
}
const tiles=[];
for(const direction of ['front','left','right','back'].filter(d=>groups.has(d))){
  const layers=groups.get(direction);
  const head=await fs.readFile(path.join(out,headRig.splitBodyOcclusion?`head-${direction}-above-body.png`:`head-${direction}-192x288.png`));
  const behind=headRig.splitBodyOcclusion?[{input:await fs.readFile(path.join(out,`head-${direction}-behind-body.png`))}]:[];
  const png=await sharp({create:{width:192,height:288,channels:4,background:'#00000000'}}).composite([...behind,...layers,{input:head}]).png().toBuffer();
  await fs.writeFile(path.join(out,`${direction}-body-study.png`),png);tiles.push({input:png,left:tiles.length*192,top:0});
}
await sharp({create:{width:192*tiles.length,height:288,channels:4,background:'#d6dfca'}}).composite(tiles).png().toFile(path.join(out,'body-review.png'));
await fs.writeFile(path.join(out,'body-audit.json'),JSON.stringify({id,parts:audit,runtimeEligible:false,visualApproved:false,status:'incomplete-source-registration-study'},null,2)+'\n');
await finishPaintedRender(root,path.join(out,'body-render-receipt.json'),receipt,rig.parts.map(p=>path.join(out,`${p.id}-registered.svg`)));
console.log(`${id}: ${audit.length} body sources registered; not runtime approved.`);
