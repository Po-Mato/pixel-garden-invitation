import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const json=async f=>JSON.parse(await readFile(new URL(f,root)));
const base='character-assets/rigs/storybook-expansion-v1/';
const selection=await json(base+'production-selection-motion-v1/evidence.json');
const game=await json(base+'production-game-motion-v1/evidence.json');
const report=await json(base+'production-motion-audit.json');
const catalog=await json('character-assets/rigs/guest-cutout-catalog-v1.json');
const revisions=await readFile(new URL('client/src/character/assetRevisions.ts',root),'utf8');
const revision=revisions.match(/guestCutoutAssetRevision = "([^"]+)"/)[1];
for(const {characterId,presetId} of catalog.characters)test(`${characterId}: production preview uses current reviewed assets and revision`,async()=>{
  assert.equal(report.passed,true);assert.equal(report.productionBuild,true);
  assert.equal(selection.captureComplete,true);assert.equal(game.captureComplete,true);
  assert.deepEqual(selection.viewport,[390,844]);assert.deepEqual(game.viewport,[390,844]);
  for(const [evidence,folder,count] of [[selection,'preview/',16],[game,'',4]]){
    const rows=evidence.rows.filter(r=>r.id===characterId);assert.equal(rows.length,count);
    assert.deepEqual([...new Set(rows.map(r=>r.direction))].sort(),['down','left','right','up']);
    const file=`guests/${folder}${presetId}__walk.png`;
    const hash=createHash('sha256').update(await readFile(new URL('client/public/characters/generated/'+file,root))).digest('hex');
    for(const row of rows){
      assert.equal(row.asset.sha256,hash);assert.equal(row.asset.status,200);
      const url=new URL(row.movingUrl??row.asset.url);
      assert.equal(url.pathname,`/characters/generated/${file}`);assert.equal(url.searchParams.get('v'),revision);
    }
  }
});
