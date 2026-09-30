import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from './lib/deterministicSharp.mjs';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),base=path.join(root,'character-assets/rigs/guest-11');
const out=path.join(base,'head-gap-repair-v1/review');await fs.mkdir(out,{recursive:true});
const inputs={};const read=async p=>{const b=await fs.readFile(p);inputs[path.relative(root,p)]=createHash('sha256').update(b).digest('hex');return b;};
const image=(b,mime)=>`<image width="1422" height="1106" href="data:${mime};base64,${b.toString('base64')}"/>`;
const previews=[];
await read(import.meta.filename);
const outputs={};
const layersByDirection={};
const layerDefinitions=JSON.parse(await read(path.join(base,'storybook-source-v1/head-layers.json')));
for(const direction of ['left','right']){
 const raw=await read(path.join(base,`storybook-source-v1/sources/head-${direction}-v1.png`));
 const silhouette=await read(path.join(base,`storybook-source-v1/masks/head-${direction}-v1.svg`));
 const gaps=await read(path.join(base,`head-gap-repair-v1/source/hair-gaps-${direction}.svg`));
 const registration=JSON.parse(await read(path.join(base,'storybook-source-v1/head-registration.json'))).heads.find(h=>h.direction===direction);
 const transform=`translate(96 126) scale(${72/(registration.chinY-registration.crownY)}) translate(${-registration.pivot[0]} ${-registration.pivot[1]})`;
 // Partition the authored original, before any registration or walk rendering.
 // The same editable hair-gap matte applies to all source layers. No frame pixels are repaired.
 const cleanSource=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1422" height="1106"><defs><mask id="outline">${image(silhouette,'image/svg+xml')}</mask><mask id="gaps">${image(gaps,'image/svg+xml')}</mask></defs><g mask="url(#outline)"><g mask="url(#gaps)">${image(raw,'image/png')}</g></g></svg>`)).ensureAlpha().raw().toBuffer();
 const remaining=Buffer.from(cleanSource),parts=[];
 const layerOut=path.join(base,'head-gap-repair-v1/generated',direction);await fs.mkdir(layerOut,{recursive:true});
 layersByDirection[direction]=[];
 for(const layer of layerDefinitions.directions[direction].layers){
  const region=layer.path?await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1422" height="1106"><rect width="100%" height="100%" fill="black"/><path d="${layer.path}" fill="white" shape-rendering="crispEdges"/></svg>`)).removeAlpha().extractChannel(0).raw().toBuffer():null;
  const rgba=Buffer.alloc(remaining.length);
  for(let i=0;i<1422*1106;i++)if(!layer.occluded&&(!region||region[i]===255)){remaining.copy(rgba,i*4,i*4,i*4+4);remaining.fill(0,i*4,i*4+4);}
  const png=await sharp(rgba,{raw:{width:1422,height:1106,channels:4}}).png().toBuffer();
  const file=path.join(layerOut,layer.id+'.png');await fs.writeFile(file,png);parts.push(rgba);
  layersByDirection[direction].push({id:layer.id,parent:layer.parent,pivot:registration.pivot,file:path.relative(root,file),sha256:createHash('sha256').update(png).digest('hex')});
 }
 if(remaining.some(Boolean))throw Error('Unassigned head source pixels');
 // Disjoint source ownership is assembled at native resolution, then registered once.
 const assembled=Buffer.alloc(cleanSource.length);
 for(const part of parts)for(let i=0;i<1422*1106;i++)if(part[i*4+3])part.copy(assembled,i*4,i*4,i*4+4);
 const texture=await sharp(assembled,{raw:{width:1422,height:1106,channels:4}}).png().toBuffer();
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><g transform="${transform}">${image(texture,'image/png')}</g></svg>`;
 await fs.writeFile(path.join(out,`head-${direction}-registered.svg`),svg);
 outputs[path.relative(root,path.join(out,`head-${direction}-registered.svg`))]=createHash('sha256').update(svg).digest('hex');
 const png=await sharp(Buffer.from(svg)).png().toBuffer();await fs.writeFile(path.join(out,`head-${direction}.png`),png);
 const old=await sharp(await read(path.join(base,`storybook-source-v1/generated/head-${direction}-registered.svg`))).png().toBuffer();
 previews.push(old,png);
}
await sharp({create:{width:768,height:288,channels:4,background:'#bbb09a'}}).composite(previews.map((input,i)=>({input,left:i*192,top:0}))).png().toFile(path.join(out,'before-after.png'));
await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify({runtimeEligible:false,status:'layered-head-source-repair',inputs,outputs,layersByDirection,order:['left-before','left-after','right-before','right-after']},null,2)+'\n');
console.log(out);
