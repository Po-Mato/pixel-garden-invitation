import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from './lib/deterministicSharp.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertSourceMatteCoverage} from './storybook-source-matte-contract.mjs';
import {beginPaintedRender,finishPaintedRender} from './lib/paintedRenderReceipt.mjs';
import {readPaintedHeadMaterial} from './lib/paintedHeadMaterial.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id=process.argv[2];assert.match(id||'',/^guest-\d{2}$/);
const base=path.join(root,'character-assets/rigs',id,'storybook-source-v1');
const rig=JSON.parse(await fs.readFile(path.join(base,'head-registration.json')));
const layerConfig=rig.layerDefinition?JSON.parse(await fs.readFile(path.join(base,rig.layerDefinition))):null;
const receipt=await beginPaintedRender(root,[
  'scripts/render-storybook-head-study.mjs','scripts/render-storybook-direction-head-layers.mjs',
  'scripts/lib/paintedHeadMaterial.mjs','scripts/lib/paintedSourceOverlay.mjs',
  'scripts/storybook-source-matte-contract.mjs','scripts/lib/paintedRenderReceipt.mjs','pnpm-lock.yaml',
  path.join(base,'head-registration.json'),path.resolve(base,rig.skeleton),
  ...(rig.layerDefinition?[path.resolve(base,rig.layerDefinition)]:[]),
  ...Object.values(layerConfig?.directions||{}).flatMap(d=>(d.hiddenSurfaces||[]).flatMap(p=>[path.resolve(base,p.source),path.resolve(base,p.matte)])),
  ...rig.heads.flatMap(p=>[p.source,p.matte,...(p.sourceOverlays||[])].map(f=>path.resolve(base,f)))
]);
if(rig.layerDefinition)execFileSync(process.execPath,[path.join(root,'scripts/render-storybook-direction-head-layers.mjs'),id]);
if(rig.splitBodyOcclusion)assert.ok(layerConfig,'Split head/body occlusion requires explicit source layers');
const skeleton=JSON.parse(await fs.readFile(path.resolve(base,rig.skeleton)));
assert.deepEqual(skeleton.canvas,[192,288]);assert.equal(skeleton.geometry.headHeight,72);
const out=path.join(base,'generated');await fs.mkdir(out,{recursive:true});
const tiles=[],audits=[];const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const [index,part] of rig.heads.entries()){
  assert.equal(part.parent,'head');assert.equal(part.mirrored,false);
  const source=await fs.readFile(path.join(base,part.source)),matte=await fs.readFile(path.join(base,part.matte));
  const {data:rgb,info,overlays}=await readPaintedHeadMaterial(base,part);
  const {data:a,info:m}=await sharp(matte).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,m.width);assert.equal(info.height,m.height);
  assertSourceMatteCoverage(a,m.width,m.height,`${id} ${part.direction} head`);
  const rgba=Buffer.alloc(a.length*4);for(let i=0;i<a.length;i++)if(a[i]){rgb.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=a[i];}
  const clean=rig.layerDefinition?await fs.readFile(path.join(out,'head-layers',part.direction,'assembled.png')):await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  await fs.writeFile(path.join(out,`head-${part.direction}.png`),clean);
  const scale=72/(part.chinY-part.crownY);assert.ok(scale>0);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><g transform="translate(96 126) scale(${scale}) translate(${-part.pivot[0]} ${-part.pivot[1]})"><image width="${info.width}" height="${info.height}" href="data:image/png;base64,${clean.toString('base64')}"/></g></svg>`;
  const png=await sharp(Buffer.from(svg)).png().toBuffer();
  await fs.writeFile(path.join(out,`head-${part.direction}-registered.svg`),svg);await fs.writeFile(path.join(out,`head-${part.direction}-192x288.png`),png);
  if(rig.splitBodyOcclusion){
    const definition=layerConfig.directions[part.direction];
    assert.ok(Array.isArray(definition.behindBody));
    for(const name of definition.behindBody)assert.ok(definition.layers.some(l=>l.id===name));
    for(const side of ['behind-body','above-body']){
      const selected=definition.layers.filter(l=>definition.behindBody.includes(l.id)===(side==='behind-body'));
      const inputs=await Promise.all(selected.map(async l=>({input:await fs.readFile(path.join(out,'head-layers',part.direction,`${l.id}.png`))})));
      let layerPng=await sharp({create:{width:info.width,height:info.height,channels:4,background:'#00000000'}}).composite(inputs).png().toBuffer();
      if(side==='behind-body'&&selected.length&&rig.bodyOcclusionUnderlapSourcePixels){
        // Editable SOURCE-material underlap for independently sampled cutout
        // layers. Extend only the hidden mask inside the original silhouette;
        // never copy a rendered head band or change any finished frame pixels.
        const radius=rig.bodyOcclusionUnderlapSourcePixels;
        assert.ok(Number.isInteger(radius)&&radius>0&&radius<=64);
        // libvips morphology uses black foreground: erode grows white alpha.
        const expanded=await sharp(layerPng).extractChannel(3).erode(radius).raw().toBuffer();
        const underlap=Buffer.alloc(a.length*4);
        for(let i=0;i<a.length;i++)if(expanded[i]&&a[i]){
          rgb.copy(underlap,i*4,i*3,i*3+3);underlap[i*4+3]=Math.min(expanded[i],a[i]);
        }
        layerPng=await sharp(underlap,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
      }
      const layerSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><g transform="translate(96 126) scale(${scale}) translate(${-part.pivot[0]} ${-part.pivot[1]})"><image width="${info.width}" height="${info.height}" href="data:image/png;base64,${layerPng.toString('base64')}"/></g></svg>`;
      await fs.writeFile(path.join(out,`head-${part.direction}-${side}.svg`),layerSvg);
      await sharp(Buffer.from(layerSvg)).png().toFile(path.join(out,`head-${part.direction}-${side}.png`));
    }
  }
  tiles.push({input:png,left:index*192,top:0});
  audits.push({direction:part.direction,sourceSha256:hash(source),matteSha256:hash(matte),sourceMaterialOverlays:overlays,scale,parent:part.parent,pivot:part.pivot});
}
await sharp({create:{width:192*tiles.length,height:288,channels:4,background:'#d6dfca'}}).composite(tiles).png().toFile(path.join(out,'head-review.png'));
await fs.writeFile(path.join(out,'head-audit.json'),JSON.stringify({id,heads:audits,headHeight:72,runtimeEligible:false,visualApproved:false},null,2)+'\n');
await finishPaintedRender(root,path.join(out,'head-render-receipt.json'),receipt,rig.heads.flatMap(p=>[
  path.join(out,`head-${p.direction}-registered.svg`),
  ...(rig.splitBodyOcclusion?['above-body','behind-body'].map(side=>path.join(out,`head-${p.direction}-${side}.svg`)):[])
]));
console.log(`${id}: ${audits.length} directional head sources registered; not runtime approved.`);
