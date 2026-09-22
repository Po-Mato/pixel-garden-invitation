import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-05/storybook-directions-v1');
const out=path.join(base,'generated');await fs.mkdir(out,{recursive:true});
const rig=JSON.parse(await fs.readFile(path.join(base,'head-registration.json')));
execFileSync(process.execPath,[path.join(root,'scripts/render-storybook-direction-head-layers.mjs')]);
const tiles=[];
const front=await fs.readFile(path.join(base,'../storybook-head-matte-v1/generated/head-registration-192x288.png'));
tiles.push({input:front,left:0,top:0});
for(const [index,h] of rig.heads.entries()){
  assert.equal(h.mirrored,false);
  const {data:rgb,info}=await sharp(path.join(base,h.source)).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {data:a,info:m}=await sharp(path.join(base,h.matte)).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,m.width);assert.equal(info.height,m.height);
  const rgba=Buffer.alloc(a.length*4);for(let i=0;i<a.length;i++)if(a[i]){rgb.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=a[i];}
  // Consume the assembled editable source layers, not a completed walking frame.
  const clean=await fs.readFile(path.join(out,'head-layers',h.direction,'assembled.png'));
  await fs.writeFile(path.join(out,`head-${h.direction}.png`),clean);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><g transform="translate(${rig.pivot}) scale(${rig.headHeight/(h.chinY-h.crownY)}) translate(${-h.sourcePivot[0]} ${-h.sourcePivot[1]})"><image width="${info.width}" height="${info.height}" href="data:image/png;base64,${clean.toString('base64')}"/></g></svg>`;
  const png=await sharp(Buffer.from(svg)).png().toBuffer();await fs.writeFile(path.join(out,`head-${h.direction}-registered.svg`),svg);await fs.writeFile(path.join(out,`head-${h.direction}-192x288.png`),png);tiles.push({input:png,left:(index+1)*192,top:0});
}
await sharp({create:{width:192*tiles.length,height:288,channels:4,background:'#d6dfca'}}).composite(tiles).png().toFile(path.join(out,'head-direction-review.png'));
console.log('Rendered directional head originals with uniform 72px registration.');
