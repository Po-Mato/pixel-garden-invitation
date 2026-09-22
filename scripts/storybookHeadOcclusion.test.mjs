import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('white source-alpha underlap expands rather than shrinks coverage',async()=>{
  const mask=Buffer.from([0,0,0,0,255,0,0,0,0]);
  const expanded=await sharp(mask,{raw:{width:3,height:3,channels:1}}).erode(1).greyscale().raw().toBuffer();
  assert.deepEqual([...expanded],Array(9).fill(255));
});
for(const guest of ['guest-01','guest-06'])for(const direction of ['front','left','right','back'])test(`${guest} ${direction}: source head occlusion introduces no opaque interior alpha gaps`,async()=>{
  const base=path.join(root,`character-assets/rigs/${guest}/storybook-source-v1/generated`);
  const original=await sharp(path.join(base,`head-${direction}-192x288.png`)).ensureAlpha().raw().toBuffer();
  const assembled=await sharp(path.join(base,`head-${direction}-behind-body.png`)).composite([{input:path.join(base,`head-${direction}-above-body.png`)}]).ensureAlpha().raw().toBuffer();
  assert.equal(original.length,assembled.length);
  for(let i=3;i<original.length;i+=4)if(original[i]===255)assert.equal(assembled[i],255,`opaque source coverage lost at pixel ${(i-3)/4}`);
});
