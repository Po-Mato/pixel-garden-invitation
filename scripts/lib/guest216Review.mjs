import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
export const svg216=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${body}</svg>`;
export async function alphaBounds216(svg){
 const{data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=-1,bottom=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=128){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 return right<0?null:{left,top,right,bottom,width:right-left+1,height:bottom-top+1};
}
export async function write216Review(base,direction,documents,head,sources,extra={}){
 const out=new URL(`generated/${direction}/`,base);await mkdir(out,{recursive:true});
 const frames=[],measurements=[];
 for(const [i,d]of documents.entries()){
  const png=await sharp(Buffer.from(d.svg)).png().toBuffer();frames.push(png);
  await writeFile(new URL(`frame-${i+1}.svg`,out),d.svg);await writeFile(new URL(`frame-${i+1}.png`,out),png);
  const feet={};for(const [side,svg]of Object.entries(d.feet||{}))feet[side]=await alphaBounds216(svg216(svg));
  measurements.push({frame:i+1,sha256:createHash('sha256').update(png).digest('hex'),silhouette:await alphaBounds216(svg216(d.body)),forward:d.forward,feet});
 }
 for(const [name,background]of [['light','#eee8de'],['dark','#29313a']])await sharp({create:{width:768,height:288,channels:4,background}}).composite(frames.map((input,i)=>({input,left:i*192,top:0}))).png().toFile(fileURLToPath(new URL(`review-${name}.png`,out)));
 const manifest={status:'candidate-not-verified',runtimeEnabled:false,direction,alphaThreshold:128,headOpaqueBounds:await alphaBounds216(svg216(head)),sources,frames:measurements,...extra};
 await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({direction,head:manifest.headOpaqueBounds,frames:measurements.map(f=>({frame:f.frame,...f.silhouette}))}));return manifest;
}
