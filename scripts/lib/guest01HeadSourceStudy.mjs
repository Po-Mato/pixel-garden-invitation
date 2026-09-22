import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readPaintedHeadMaterial} from './paintedHeadMaterial.mjs';

// Original source RGB -> editable ownership masks -> fixed registration.
// No finished head/frame image is read, cropped or repaired.
export async function renderGuest01HeadSourceStudy(base,out,direction,files){
 const rig=JSON.parse(await fs.readFile(path.join(base,'head-registration.json')));
 const config=JSON.parse(await fs.readFile(path.join(base,rig.layerDefinition)));
 const part=rig.heads.find(p=>p.direction===direction),definition=config.directions[direction];
 assert.equal(part.mirrored,false);assert.ok(!definition.hiddenSurfaces);
 const {data:rgb,info,overlays}=await readPaintedHeadMaterial(base,{...part,sourceOverlays:[...(part.sourceOverlays||[]),...files]});
 const alpha=await sharp(path.resolve(base,part.matte)).ensureAlpha().extractChannel(3).raw().toBuffer();
 const remaining=Buffer.from(alpha),parts=new Map();
 for(const layer of definition.layers){
  const region=layer.path?await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}"><rect width="100%" height="100%" fill="black"/><path shape-rendering="crispEdges" fill="white" d="${layer.path}"/></svg>`)).removeAlpha().extractChannel(0).raw().toBuffer():null;
  const rgba=Buffer.alloc(alpha.length*4);
  for(let i=0;i<alpha.length;i++)if(!layer.occluded&&(!region||region[i]===255)){const a=remaining[i];remaining[i]=0;if(a){rgb.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=a;}}
  parts.set(layer.id,await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer());
 }
 assert.ok(remaining.every(a=>a===0));
 const result={overlays};
 for(const side of ['behind-body','above-body']){
  const selected=definition.layers.filter(l=>definition.behindBody.includes(l.id)===(side==='behind-body'));
  let png=await sharp({create:{width:info.width,height:info.height,channels:4,background:'#00000000'}}).composite(selected.map(l=>({input:parts.get(l.id)}))).png().toBuffer();
  if(side==='behind-body'&&selected.length&&rig.bodyOcclusionUnderlapSourcePixels){
   const expanded=await sharp(png).extractChannel(3).erode(rig.bodyOcclusionUnderlapSourcePixels).raw().toBuffer();
   const underlap=Buffer.alloc(alpha.length*4);
   for(let i=0;i<alpha.length;i++)if(expanded[i]&&alpha[i]){rgb.copy(underlap,i*4,i*3,i*3+3);underlap[i*4+3]=Math.min(expanded[i],alpha[i]);}
   png=await sharp(underlap,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  }
  const scale=72/(part.chinY-part.crownY);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><g transform="translate(96 126) scale(${scale}) translate(${-part.pivot[0]} ${-part.pivot[1]})"><image width="${info.width}" height="${info.height}" href="data:image/png;base64,${png.toString('base64')}"/></g></svg>`;
  const file=path.join(out,`head-${direction}-${side}.svg`);await fs.writeFile(file,svg);result[side]=file;
 }
 return result;
}
