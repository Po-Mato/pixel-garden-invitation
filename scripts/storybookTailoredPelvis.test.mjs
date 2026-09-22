import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const id of ['guest-03','guest-04'])for(const view of ['front','profile'])test(`${id} ${view}: hidden pelvis joins fixed thighs without exposed shorts extension`,async()=>{
  const {data,info}=await sharp(path.join(root,`character-assets/rigs/${id}/storybook-source-v1/sources/pelvis-${view}.svg`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,192);assert.equal(info.height,288);
  for(let y=194;y<288;y++)for(let x=0;x<192;x++)assert.equal(data[(y*192+x)*4+3],0);
  assert.equal(data[(192*192+96)*4+3],255,'source underlap must reach fixed thigh root');
});
