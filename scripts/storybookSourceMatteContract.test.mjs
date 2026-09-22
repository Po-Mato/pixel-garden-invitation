import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertSourceMatteCoverage} from './storybook-source-matte-contract.mjs';
test('empty source trace cannot silently remove a costume',()=>{
  assert.throws(()=>assertSourceMatteCoverage(Buffer.alloc(10000),100,100,'costume'),/almost empty/);
});
test('tiny detached outline fragment is not a valid whole source silhouette',()=>{
  const a=Buffer.alloc(10000);a.fill(255,0,5);
  assert.throws(()=>assertSourceMatteCoverage(a,100,100,'costume'),/almost empty/);
});
test('matte contract validates source channel dimensions',()=>{
  assert.throws(()=>assertSourceMatteCoverage(Buffer.alloc(99),10,10,'costume'),/dimensions/);
});
test('manually authored guest01 cream silhouette preserves cloth and excludes neckline/background',async()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const {data,info}=await sharp(path.join(root,'character-assets/rigs/guest-01/storybook-source-v1/masks/torso-front-v2.svg')).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
  assertSourceMatteCoverage(data,info.width,info.height,'guest01 torso');
  for(const [x,y] of [[620,500],[450,600],[820,600],[620,750],[760,990],[850,1120]])assert.equal(data[y*info.width+x],255,'cream material must remain opaque');
  for(const [x,y] of [[0,0],[620,180],[1200,600],[100,700]])assert.equal(data[y*info.width+x],0,'exterior/checker must be excluded');
});
test('guest01 reviewed warm-ink silhouette keeps cream and thin ties, rejecting checker',async()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const {data,info}=await sharp(path.join(root,'character-assets/rigs/guest-01/storybook-source-v1/masks/torso-front-v2-warm-outline.svg')).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
  assertSourceMatteCoverage(data,info.width,info.height,'guest01 warm-ink torso');
  for(const [x,y] of [[620,500],[450,600],[820,600],[620,750],[760,990],[850,1120]])assert.equal(data[y*info.width+x],255);
  for(const [x,y] of [[0,0],[620,180],[1200,600],[100,700],[800,1130]])assert.equal(data[y*info.width+x],0);
});
