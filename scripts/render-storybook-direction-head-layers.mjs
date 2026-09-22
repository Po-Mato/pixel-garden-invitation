import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from './lib/deterministicSharp.mjs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readPaintedHeadMaterial} from './lib/paintedHeadMaterial.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id=process.argv[2];if(id)assert.match(id,/^guest-\d{2}$/);
const base=path.join(root,'character-assets/rigs',id?`${id}/storybook-source-v1`:'guest-05/storybook-directions-v1');
const config=JSON.parse(await fs.readFile(path.join(base,'head-layers.json')));
const registeredHeads=id?JSON.parse(await fs.readFile(path.join(base,'head-registration.json'))).heads:null;
for(const [direction,definition] of Object.entries(config.directions)){
  const out=path.join(base,'generated/head-layers',direction);await fs.mkdir(out,{recursive:true});
  const registered=registeredHeads?.find(p=>p.direction===direction);
  if(registeredHeads){assert.ok(registered,`${direction}: missing head registration`);assert.deepEqual(definition.sourcePivot,registered.pivot,`${direction}: layer ownership must be reviewed for current source pivot`);}
  const sourcePath=registered?.source||`sources/head-${direction}-v1.png`;
  const mattePath=registered?.matte||`masks/head-${direction}-v1.svg`;
  const {data:rgb,info,overlays}=await readPaintedHeadMaterial(base,registered||{source:sourcePath,sourceOverlays:definition.sourceOverlays});
  const {data:coverage,info:matteInfo}=await sharp(path.join(base,mattePath)).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,matteInfo.width);assert.equal(info.height,matteInfo.height);
  const remaining=Buffer.from(coverage),parts=[],counts={};
  for(const layer of definition.layers){
    assert.equal(layer.parent,'head');
    const region=layer.path?await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}"><rect width="100%" height="100%" fill="black"/><path shape-rendering="crispEdges" fill="white" d="${layer.path}"/></svg>`)).removeAlpha().extractChannel(0).raw().toBuffer():null;
    const rgba=Buffer.alloc(coverage.length*4);let count=0;
    for(let i=0;i<coverage.length;i++)if(!layer.occluded&&(!region||region[i]===255)){
      const a=remaining[i];remaining[i]=0;if(a){rgb.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=a;count++;}
    }
    counts[layer.id]=count;
    const png=await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
    await fs.writeFile(path.join(out,`${layer.id}.png`),png);parts.push(png);
  }
  assert(remaining.every(x=>x===0));
  const hiddenSurfaceAudit=[];
  // Complete editable skin UNDER the original hair. This operates on source
  // layers before registration, not on a walk frame or its rendered pixels.
  for(const hidden of definition.hiddenSurfaces||[]){
    assert.match(hidden.id,/^[A-Za-z][A-Za-z0-9]*$/);
    const target=definition.layers.findIndex(l=>l.id===hidden.target);
    assert.ok(target>=0,'Hidden surface target must name a source layer');
    assert.ok(hidden.occludedBy?.length>0,'Hidden skin requires explicit occluding layers');
    const occluders=hidden.occludedBy.map(name=>{
      const index=definition.layers.findIndex(l=>l.id===name);
      assert.ok(index>target,'Occluding hair must composite after its skin target');
      return index;
    });
    assert.match(hidden.matte,/\.svg$/,'Hidden surface matte must remain editable');
    const {data:paint,info:paintInfo}=await sharp(path.resolve(base,hidden.source)).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const {data:mask,info:maskInfo}=await sharp(path.resolve(base,hidden.matte)).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
    for(const m of [paintInfo,maskInfo]){assert.equal(m.width,info.width);assert.equal(m.height,info.height);}
    const visible=await sharp(parts[target]).ensureAlpha().raw().toBuffer();
    const covers=await Promise.all(occluders.map(i=>sharp(parts[i]).ensureAlpha().extractChannel(3).raw().toBuffer()));
    const rgba=Buffer.alloc(coverage.length*4);let count=0;
    for(let i=0;i<coverage.length;i++)if(mask[i]&&visible[i*4+3]===0&&covers.some(a=>a[i]===255)){
      paint.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=mask[i];count++;
    }
    assert.ok(count>0,'Hidden source adds no editable skin');
    const underpaint=await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
    await fs.writeFile(path.join(out,`${hidden.id}.png`),underpaint);
    await fs.writeFile(path.join(out,`${hidden.target}-visible.png`),parts[target]);
    // The new skin and original visible face are disjoint source regions.
    // Retain the original source's straight-alpha values: another source-over
    // round trip would quantize its existing semitransparent outer contour.
    const extended=Buffer.from(visible);
    for(let i=0;i<coverage.length;i++)if(rgba[i*4+3])rgba.copy(extended,i*4,i*4,i*4+4);
    parts[target]=await sharp(extended,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
    await fs.writeFile(path.join(out,`${hidden.target}.png`),parts[target]);
    hiddenSurfaceAudit.push({id:hidden.id,target:hidden.target,occludedBy:hidden.occludedBy,source:hidden.source,matte:hidden.matte,addedPixels:count,parent:'head'});
  }
  const assembled=await sharp({create:{width:info.width,height:info.height,channels:4,background:'#00000000'}}).composite(parts.map(input=>({input}))).png().toBuffer();
  await fs.writeFile(path.join(out,'assembled.png'),assembled);
  const combined=await sharp(assembled).ensureAlpha().raw().toBuffer();let maxRgbDelta=0;
  for(let i=0;i<coverage.length;i++){
    assert.equal(combined[i*4+3],coverage[i]);
    if(!coverage[i]){assert.equal(combined[i*4]+combined[i*4+1]+combined[i*4+2],0);continue;}
    for(let c=0;c<3;c++){const delta=Math.abs(combined[i*4+c]-rgb[i*3+c]);maxRgbDelta=Math.max(maxRgbDelta,delta);if(coverage[i]===255)assert.equal(delta,0);}
  }
  const tiles=[];for(const [i,png] of parts.entries())tiles.push({input:await sharp(png).resize({width:300,height:320,fit:'inside'}).png().toBuffer(),left:i*300,top:0});
  await sharp({create:{width:900,height:320,channels:4,background:'#e4e8dd'}}).composite(tiles).png().toFile(path.join(out,'parts-review.png'));
  await fs.writeFile(path.join(out,'audit.json'),JSON.stringify({direction,counts,hiddenSurfaceAudit,sourceMaterialOverlays:overlays,opaqueRgbReference:'source-material-before-partition',completeCoverage:true,composedAlphaUnchanged:true,opaqueRgbUnchanged:true,maxRgbDelta,sourcePivot:definition.sourcePivot,parent:'head',independentMotionAllowed:false,runtimeEligible:false},null,2)+'\n');
}
console.log('Directional visible head layers exported; hidden-surface editing remains unapproved.');
