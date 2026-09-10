import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=new URL('../',import.meta.url),output=new URL('character-assets/generated/three-head-216-runtime-package/',root);
const hash=b=>createHash('sha256').update(b).digest('hex');
test('real production packager consumes 216px candidates without body-region edits or NPC changes',async()=>{
 const catalog=JSON.parse(await readFile(new URL('character-assets/rigs/guest-cutout-catalog-v1.json',root)));
 const npcs=JSON.parse(await readFile(new URL('shared/character-catalog.json',root))).npcs;
 const manifest=JSON.parse(await readFile(new URL('build-manifest.json',output)));
 assert.equal(manifest.publicAssetsModified,false);assert.equal(manifest.productionIntegrated,false);
 assert.equal(manifest.count,12*7+npcs.length*2);assert.equal(manifest.files.length,manifest.count);
 for(const item of manifest.files)assert.equal(hash(await readFile(new URL(item.file,output))),item.sha256);
 for(const c of catalog.characters){
  const base=new URL(`character-assets/generated/three-head-216-v1/${c.presetId}/`,root);
  for(const kind of ['walk','idle']){
   const runtime=await readFile(new URL(`${c.presetId}__${kind}-runtime.png`,base));
   const hd=await readFile(new URL(`${c.presetId}__${kind}-hd.png`,base));
   assert.deepEqual(await readFile(new URL(`guests/${c.presetId}__${kind}.png`,output)),runtime);
   assert.deepEqual(await readFile(new URL(`guests/preview/${c.presetId}__${kind}.png`,output)),hd);
   const size=kind==='walk'?[192,288]:[96,72];
   assert.deepEqual(await sharp(await readFile(new URL(`guests/world/${c.presetId}__${kind}.png`,output))).raw().toBuffer(),await sharp(runtime).resize(...size,{kernel:'nearest'}).raw().toBuffer());
  }
  const idle=await readFile(new URL(`${c.presetId}__idle-runtime.png`,base));
  const expected=await sharp(idle).extract({left:0,top:0,width:96,height:144}).resize(192,288,{kernel:'nearest'}).raw().toBuffer();
  assert.deepEqual(await sharp(await readFile(new URL(`guests/portraits/${c.presetId}.png`,output))).raw().toBuffer(),expected);
 }
 for(const npc of npcs)for(const kind of ['idle','walk'])assert.deepEqual(await readFile(new URL(`npc/${npc.id}__${kind}.png`,output)),await readFile(new URL(`character-assets/source/npc/${npc.id}-${kind}.png`,root)));
});
