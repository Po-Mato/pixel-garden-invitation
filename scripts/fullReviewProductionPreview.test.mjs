import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),base='character-assets/rigs/full-review-release-v1/production-browser/';
const evidence=JSON.parse(await fs.readFile(new URL(base+'evidence.json',root)));
const manifest=JSON.parse(await fs.readFile(new URL('character-assets/generated/full-review-v1/build-manifest.json',root)));
const revision=(await fs.readFile(new URL('client/src/character/assetRevisions.ts',root),'utf8')).match(/guestCutoutAssetRevision = "([^"]+)"/)[1];
test('production build browser covers 48 directions, 192 frame states and runtime hashes',async()=>{
 assert.equal(evidence.productionBuild,true);assert.equal(evidence.complete,true);assert.deepEqual(evidence.errors,[]);assert.equal(evidence.rows.length,48);assert.equal(evidence.runtimeHashes.length,24);
 for(const c of manifest.characters){
  const rows=evidence.rows.filter(r=>r.id===c.characterId);assert.deepEqual(rows.map(r=>r.direction).sort(),['down','left','right','up']);
  for(const row of rows){assert.deepEqual(row.frames,['0','1','2','3']);assert.equal(row.sha256,c.outputs.find(o=>o.file===`${c.presetId}__walk-hd.png`).sha256);assert.equal(new URL(row.url).searchParams.get('v'),revision);await fs.access(new URL(base+row.file,root));}
 }
 for(const r of evidence.runtimeHashes)assert.equal(createHash('sha256').update(await fs.readFile(new URL('client/public/characters/generated/guests/'+r.file,root))).digest('hex'),r.sha256);
 assert.equal(evidence.game.direction,'left');assert.deepEqual(evidence.game.size,['48px','72px']);
});
