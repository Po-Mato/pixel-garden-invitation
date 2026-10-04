import assert from 'node:assert/strict';
import sharp from './deterministicSharp.mjs';
import {relativeLuminance,contrastRatio,displayCalibrationProfiles} from './mapToneAudit.mjs';

// Offline QA scene only. This never alters or exports character source/runtime assets.
// Model CSS sRGB tone filters and sequential zero-blur drop shadows, including the optional opposite-edge shadow.
// This is not browser or mobile evidence.
export async function halfSizeSprite(frame){
 const {data,info}=await sharp(frame).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,96);assert.equal(info.height,144);
 const out=Buffer.alloc(48*72*4);
 // Exact 2:1 bilinear sample at pixel centres, in premultiplied-alpha space.
 // Lanczos sharpening is inappropriate for modelling a Canvas drawImage sample.
 for(let y=0;y<72;y++)for(let x=0;x<48;x++){
  const offsets=[0,1,96,97].map(n=>((y*2)*96+x*2+n)*4),o=(y*48+x)*4,a=offsets.reduce((n,i)=>n+data[i+3],0);
  out[o+3]=Math.round(a/4);if(a)for(let k=0;k<3;k++)out[o+k]=Math.round(offsets.reduce((n,i)=>n+data[i+k]*data[i+3],0)/a);
 }
 return sharp(out,{raw:{width:48,height:72,channels:4}}).png().toBuffer();
}
export async function characterSceneLayer(sprite,tone,shadow,secondaryShadow=shadow,outline){
 const {data,info}=await sharp(sprite).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,48);assert.equal(info.height,72);
 const filters=[...tone.matchAll(/(contrast|saturate|brightness)\(([\d.]+)\)/g)];
 assert.equal(filters.map(m=>m[0]).join(' '),tone.trim(),'Unsupported CSS tone filter');
 for(let i=0;i<data.length;i+=4){
  let rgb=[data[i]/255,data[i+1]/255,data[i+2]/255];
  for(const [,kind,n]of filters){const v=Number(n),l=rgb[0]*.213+rgb[1]*.715+rgb[2]*.072;rgb=rgb.map(c=>Math.max(0,Math.min(1,kind==='contrast'?(c-.5)*v+.5:kind==='brightness'?c*v:l+(c-l)*v)));}
  rgb.forEach((c,k)=>data[i+k]=Math.round(c*255));
 }
 const clear=()=>sharp({create:{width:84,height:104,channels:4,background:'#00000000'}});
 const png=await sharp(data,{raw:info}).png().toBuffer();
 let layer=await clear().composite([{input:png,left:18,top:16}]).png().toBuffer();
 for(const [dx,dy,color]of [...(outline?[[-1,-1,outline]]:[]),[0,1,shadow],[1,2,secondaryShadow]]){
  const rgba=color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);assert.ok(rgba,'Unsupported shadow color');
  const {data:raw,info:meta}=await sharp(layer).ensureAlpha().raw().toBuffer({resolveWithObject:true}),shade=Buffer.alloc(raw.length);
  for(let y=0;y<meta.height;y++)for(let x=0;x<meta.width;x++){
   if(x+dx<0||x+dx>=meta.width||y+dy<0||y+dy>=meta.height)continue;
   const src=(y*meta.width+x)*4,dst=((y+dy)*meta.width+x+dx)*4;
   for(let k=0;k<3;k++)shade[dst+k]=Number(rgba[k+1]);shade[dst+3]=Math.round(raw[src+3]*Number(rgba[4]));
  }
  layer=await sharp(shade,{raw:meta}).composite([{input:layer,left:0,top:0}]).png().toBuffer();
 }
 return layer;
}
export function measureSceneEdge(scene,source){
 assert.equal(scene.length,48*72*4);assert.equal(source.length,48*72*4);
 const profiles={standard:v=>v,...Object.fromEntries(Object.entries(displayCalibrationProfiles).map(([id,p])=>[id,p.adjustLuminance]))};
 const ratios=Object.fromEntries(Object.keys(profiles).map(id=>[id,[]]));
 for(let y=0;y<72;y++)for(let x=0;x<48;x++){
  const i=(y*48+x)*4;if(source[i+3]<96)continue;
  const outside=[[-1,0],[1,0],[0,-1],[0,1]].flatMap(([dx,dy])=>{const X=x+dx,Y=y+dy,o=(Y*48+X)*4;return X>=0&&X<48&&Y>=0&&Y<72&&source[o+3]<32?[o]:[];});
  if(!outside.length)continue;
  const inside=relativeLuminance([...scene.subarray(i,i+3)]),lums=outside.map(o=>relativeLuminance([...scene.subarray(o,o+3)]));
  for(const [id,adjust]of Object.entries(profiles))ratios[id].push(Math.max(...lums.map(l=>contrastRatio(adjust(inside),adjust(l)))));
 }
 assert.ok(ratios.standard.length>0);
 return Object.fromEntries(Object.entries(ratios).map(([id,v])=>{v.sort((a,b)=>a-b);return[id,v[Math.floor(v.length*.2)]];}));
}
