import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';

export const storybookBase=new URL('../character-assets/rigs/guest-05/storybook-rig-v1/',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function readStorybook(){
 const rig=JSON.parse(await readFile(new URL('front-rig.json',storybookBase)));
 const skeleton=JSON.parse(await readFile(new URL(rig.skeleton,storybookBase)));
 const art=await readFile(new URL(rig.source,storybookBase),'utf8');
 assert.deepEqual(rig.geometry,skeleton.geometry);
 assert.ok(!/<(?:image|foreignObject|script)\b|\b(?:href|transform|filter)=/i.test(art),'Only authored vector geometry; no image embedding, rescaling or postprocessing');
 const defs=art.match(/<defs>[\s\S]*?<\/defs>/)?.[0];assert.ok(defs);
 const layers=new Map([...art.matchAll(/<!-- part:(\w+) -->\s*([\s\S]*?)\s*<!-- \/part -->/g)].map(m=>[m[1],m[2]]));
 assert.equal(layers.size,rig.parts.length);
 for(const p of rig.parts){assert.ok(layers.has(p.sourceLayer));assert.ok(layers.get(p.sourceLayer).startsWith(`<g id="${p.id}"`),'Each part must retain its independently selectable root group');assert.equal(p.mirrored,false);assert.deepEqual(p.pivot,skeleton.bones[p.parent].pivot);}
 const svg=names=>`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288" viewBox="0 0 192 288">${defs}${names.map(n=>layers.get(n)).join('')}</svg>`;
 return {rig,skeleton,art,layers,svg};
}
export async function boundsSvg(svg,region=[0,0,192,288]){
 const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let l=192,t=288,r=-1,b=-1;const[x,y,w,h]=region;
 for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(data[(yy*info.width+xx)*4+3]>=128){l=Math.min(l,xx);r=Math.max(r,xx);t=Math.min(t,yy);b=Math.max(b,yy);}
 return r<0?null:{left:l,top:t,right:r,bottom:b,width:r-l+1,height:b-t+1};
}
export async function renderStorybook(){
 const {rig,skeleton,art,svg}=await readStorybook();
 const out=new URL('generated/',storybookBase);await mkdir(new URL('parts/',out),{recursive:true});
 const names=rig.parts.map(p=>p.sourceLayer),bodyNames=names.filter(n=>!rig.measurement.exclude.includes(n));
 const neutral=svg(names),body=svg(bodyNames);
 const png=await sharp(Buffer.from(neutral)).png().toBuffer();
 await writeFile(new URL('neutral.svg',out),neutral);await writeFile(new URL('neutral.png',out),png);
 for(const scale of[.5,.25])await writeFile(new URL(`neutral-${192*scale}x${288*scale}.png`,out),await sharp(png).resize(192*scale,288*scale).png().toBuffer());
 const parts=[];
 for(const p of rig.parts){const part=svg([p.sourceLayer]);await writeFile(new URL(`parts/${p.id}.svg`,out),part);parts.push({...p,bounds:await boundsSvg(part)});}
 const report={status:'neutral-prototype',runtimeEnabled:false,canvas:skeleton.canvas,geometry:rig.geometry,sourceSha256:hash(art),rigSha256:hash(await readFile(new URL('front-rig.json',storybookBase))),skeletonSha256:hash(await readFile(new URL(rig.skeleton,storybookBase))),conceptSha256:hash(await readFile(new URL(rig.concept,storybookBase))),pngSha256:hash(png),bodyBounds:await boundsSvg(body),cranialBounds:await boundsSvg(svg(['backHair','face','frontHair']),rig.measurement.cranialRegion),parts,visualReview:'Separate visual fidelity review required; pixel geometry passing does not approve the art.',unimplemented:['left','right','back','walk-cycle','runtime integration','map contrast','production deployment']};
 await writeFile(new URL('manifest.json',out),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({body:report.bodyBounds,head:report.cranialBounds,parts:parts.length}));return report;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await renderStorybook();
