import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
const base=new URL('../character-assets/rigs/guest-07/storybook-source-v1/',import.meta.url);
test('guest07 right neck shading retains the exact original silhouette',async()=>{
  const original=new URL('../../guest-01/storybook-source-v1/sources/neck-front.svg',base);
  const revised=new URL('sources/neck-right-shading-v1.svg',base);
  const raw=async u=>sharp(await fs.readFile(u)).ensureAlpha().raw().toBuffer();
  const a=await raw(original),b=await raw(revised);
  assert.equal(a.length,b.length);let changes=0;
  for(let i=0;i<a.length;i+=4){
    assert.equal(a[i+3],b[i+3],'Neck shading must not grow, shorten or erase the neck');
    if(a[i+3]===0)assert.deepEqual(a.subarray(i,i+4),b.subarray(i,i+4));
    else if(!a.subarray(i,i+3).equals(b.subarray(i,i+3)))changes++;
  }
  assert.ok(changes>0);
});
test('neck material override belongs only to the reviewed right direction',async()=>{
  const rig=JSON.parse(await fs.readFile(new URL('body-registration.json',base)));
  const parts=rig.parts.filter(p=>p.parent==='neck');
  assert.equal(parts.length,4);
  for(const p of parts){
    assert.deepEqual(p.pivot,[96,126]);assert.equal(p.mirrored,false);
    assert.equal(p.vector,p.direction==='right'?'sources/neck-right-shading-v1.svg':'../../guest-01/storybook-source-v1/sources/neck-front.svg');
  }
});
test('guest10 nape shading retains its fixed neck silhouette and independent directional binding',async()=>{
  const navy=new URL('../character-assets/rigs/guest-10/storybook-source-v1/',import.meta.url);
  const raw=async u=>sharp(await fs.readFile(u)).ensureAlpha().raw().toBuffer();
  const original=await raw(new URL('../../guest-01/storybook-source-v1/sources/neck-front.svg',navy));
  const revised=await raw(new URL('sources/neck-right-shading-study-v1.svg',navy));
  assert.equal(original.length,revised.length);
  let changed=0;
  for(let i=0;i<original.length;i+=4){
    assert.equal(original[i+3],revised[i+3]);
    if(!original[i+3])assert.deepEqual(original.subarray(i,i+4),revised.subarray(i,i+4));
    else if(!original.subarray(i,i+3).equals(revised.subarray(i,i+3)))changed++;
  }
  assert.ok(changed>0);
  const rig=JSON.parse(await fs.readFile(new URL('body-registration.json',navy)));
  for(const p of rig.parts.filter(p=>p.parent==='neck')){
    assert.deepEqual(p.pivot,[96,126]);assert.equal(p.mirrored,false);
    assert.equal(p.vector,p.direction==='right'?'sources/neck-right-shading-study-v1.svg':'../../guest-01/storybook-source-v1/sources/neck-front.svg');
  }
});
