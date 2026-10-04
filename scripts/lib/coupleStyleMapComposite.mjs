import assert from 'node:assert/strict';
import sharp from './deterministicSharp.mjs';
import {relativeLuminance,contrastRatio,displayCalibrationProfiles} from './mapToneAudit.mjs';

// Offline QA scene only. This never alters or exports character source/runtime assets.
// Model CSS sRGB tone filters and sequential zero-blur drop shadows, including the optional opposite-edge shadow.
// This is not browser or mobile evidence.
export async function characterSceneLayer(sprite,tone,shadow,secondaryShadow=shadow,outline){
 const {data,info}=await sharp(sprite).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,84);assert.equal(info.height,104);
 const filters=[...tone.matchAll(/(contrast|saturate|brightness)\(([\d.]+)\)/g)];
 assert.equal(filters.map(m=>m[0]).join(' '),tone.trim(),'Unsupported CSS tone filter');
 for(let i=0;i<data.length;i+=4){
  let rgb=[data[i]/255,data[i+1]/255,data[i+2]/255];
  for(const [,kind,n]of filters){const v=Number(n),l=rgb[0]*.213+rgb[1]*.715+rgb[2]*.072;rgb=rgb.map(c=>Math.max(0,Math.min(1,kind==='contrast'?(c-.5)*v+.5:kind==='brightness'?c*v:l+(c-l)*v)));}
  rgb.forEach((c,k)=>data[i+k]=Math.round(c*255));
 }
 const clear=()=>sharp({create:{width:84,height:104,channels:4,background:'#00000000'}});
 const png=await sharp(data,{raw:info}).png().toBuffer();
 let layer=await clear().composite([{input:png,left:0,top:0}]).png().toBuffer();
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
 assert.equal(scene.length,84*104*4);assert.equal(source.length,84*104*4);
 const profiles={standard:v=>v,...Object.fromEntries(Object.entries(displayCalibrationProfiles).map(([id,p])=>[id,p.adjustLuminance]))};
 const ratios=Object.fromEntries(Object.keys(profiles).map(id=>[id,[]]));
 for(let y=0;y<104;y++)for(let x=0;x<84;x++){
  const i=(y*84+x)*4;if(source[i+3]<96)continue;
  const outside=[[-1,0],[1,0],[0,-1],[0,1]].flatMap(([dx,dy])=>{const X=x+dx,Y=y+dy,o=(Y*84+X)*4;return X>=0&&X<84&&Y>=0&&Y<104&&source[o+3]<32?[o]:[];});
  if(!outside.length)continue;
  const inside=relativeLuminance([...scene.subarray(i,i+3)]),lums=outside.map(o=>relativeLuminance([...scene.subarray(o,o+3)]));
  for(const [id,adjust]of Object.entries(profiles))ratios[id].push(Math.max(...lums.map(l=>contrastRatio(adjust(inside),adjust(l)))));
 }
 assert.ok(ratios.standard.length>0);
 return Object.fromEntries(Object.entries(ratios).map(([id,v])=>{v.sort((a,b)=>a-b);return[id,v[Math.floor(v.length*.2)]];}));
}

// Bilinear premultiplied sampling of the CSS transformed inner layer onto
// the unchanged 84x104 audit region. Outer 48x72 frame starts at (18,16).
export async function renderCoupleStyleWorldFrame(frame) {
 const {data,info}=await sharp(frame).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,96);assert.equal(info.height,144);
 const filtered=Buffer.from(data);
 for(let i=0;i<data.length;i+=4){
  const c=[0,1,2].map(k=>Math.max(0,Math.min(1,(data[i+k]/255-.5)*1.08+.5)));
  const l=c[0]*.213+c[1]*.715+c[2]*.072;
  c.forEach((v,k)=>filtered[i+k]=Math.round(Math.max(0,Math.min(1,l+(v-l)*.92))*255));
 }
 const out=Buffer.alloc(84*104*4),scale=7/12;
 for(let y=0;y<104;y++)for(let x=0;x<84;x++){
  const sx=(x+.5-14)/scale-.5,sy=(y+.5-4.75)/scale-.5;
  const bx=Math.floor(sx),by=Math.floor(sy),fx=sx-bx,fy=sy-by;
  const rgb=[0,0,0];let alpha=0;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
   const X=bx+dx,Y=by+dy;if(X<0||X>=96||Y<0||Y>=144)continue;
   const i=(Y*96+X)*4,w=(dx?fx:1-fx)*(dy?fy:1-fy),a=filtered[i+3]*w;alpha+=a;
   for(let k=0;k<3;k++)rgb[k]+=filtered[i+k]*a;
  }
  const o=(y*84+x)*4;out[o+3]=Math.round(alpha);
  if(alpha)for(let k=0;k<3;k++)out[o+k]=Math.round(rgb[k]/alpha);
 }
 return sharp(out,{raw:{width:84,height:104,channels:4}}).png().toBuffer();
}
export function assertCoupleStyleWorldCss(css){
 assert.ok(css.includes('translate(-4px, -11.25px)'));
 assert.ok(css.includes('* 1.166666667)'));
 assert.ok(css.includes('filter: contrast(1.08) saturate(0.92);'));
}
