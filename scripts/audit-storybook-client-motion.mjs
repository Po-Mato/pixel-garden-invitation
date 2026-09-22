import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {assertStorybookClientQaFresh} from './lib/storybookClientQaFreshness.mjs';
import {isCompleteMotionCapture} from './lib/storybookMotionCoverage.mjs';

// Evidence validation is not visual approval. Read the actual current staging
// bytes, not merely a matching hash copied between two historical reports.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/storybook-expansion-v1');
const catalog=JSON.parse(await readFile(path.join(root,'character-assets/rigs/guest-cutout-catalog-v1.json'))).characters;
const directions=['down','left','right','up'];
const live=process.env.STORYBOOK_CAPTURE_TARGET==='live';
const production=live||process.env.STORYBOOK_CAPTURE_TARGET==='production';
const prefix=live?'live':production?'production':'client';
const zone=process.argv[2]??'home';
assert.ok(['home','neighborhood','subway-station','subway-train'].includes(zone));
const gameDirectory=zone==='home'?`${prefix}-game-motion-v1`:`${prefix}-game-${zone}-motion-v1`;
const selectionDirectory=`${prefix}-selection-motion-v1`;
const read=async p=>JSON.parse(await readFile(p));
const selection=await read(path.join(base,selectionDirectory,'evidence.json'));
const game=await read(path.join(base,gameDirectory,'evidence.json'));
assert.equal(catalog.length,12);
assert.equal(selection.captureComplete,true);
assert.equal(game.captureComplete,true);
assert.equal(selection.rows.length,192);
assert.equal(game.rows.length,48);
assert.ok(isCompleteMotionCapture(catalog.map(c=>c.characterId),game.rows));
const checked=new Map();
async function asset(e,url,expected){
  const relative=new URL(url).pathname.split('/characters/generated/')[1];
  assert.equal(relative,expected);
  assert.equal(e.status,200);if(!production)assert.equal(e.sha256,e.header);
  if(!checked.has(relative)){
    const bytes=await readFile(path.join(root,production?'client/public/characters/generated':'character-assets/generated/storybook-client-qa-v1',relative));
    await assertStorybookClientQaFresh(root,relative,bytes);
    checked.set(relative,createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(checked.get(relative),e.sha256);
}
async function screenshot(dir,filename){
  assert.match(filename,/^guest-\d{2}-(down|left|right|up)-[0-3]\.png$/);
  const m=await sharp(path.join(base,dir,filename)).metadata();
  assert.deepEqual([m.width,m.height],[390,844]);
}
for(const c of catalog)for(const direction of directions){
  const rows=selection.rows.filter(r=>r.id===c.characterId&&r.direction===direction);
  assert.deepEqual(rows.map(r=>r.frame).sort(),[0,1,2,3]);
  for(const r of rows){
    assert.equal(r.before.frame,String(r.frame));assert.equal(r.after.frame,String(r.frame));
    assert.equal(r.before.direction,direction);assert.equal(r.after.direction,direction);
    assert.equal(r.after.changes,0);assert.equal(r.after.moving,'true');assert.equal(r.after.fallback,false);
    assert.equal(r.asset.preset,c.presetId);
    await asset(r.asset,r.asset.url,`guests/preview/${c.presetId}__walk.png`);
    await screenshot(selectionDirectory,r.filename);
  }
  const matches=game.rows.filter(r=>r.id===c.characterId&&r.direction===direction);
  assert.equal(matches.length,1);
  const r=matches[0];
  assert.equal(r.initial.zone,zone);assert.equal(r.stopped.zone,zone);
  assert.deepEqual(r.delta,r.stopped.position.map((v,i)=>v-r.initial.position[i]));
  assert.deepEqual(r.captures.map(f=>f.frame).sort(),[0,1,2,3]);
  const [axis,sign]={down:[1,1],up:[1,-1],left:[0,-1],right:[0,1]}[direction];
  assert.ok(r.delta[axis]*sign>0);assert.ok(Math.abs(r.delta[1-axis])<=1);
  assert.equal(r.stopped.moving,'false');
  await asset(r.asset,r.movingUrl,`guests/${c.presetId}__walk.png`);
  for(const f of r.captures){
    for(const state of [f.before,f.after]){
      assert.equal(state.frame,f.frame);assert.equal(state.direction,direction);assert.equal(state.moving,'true');
      assert.equal(state.preset,c.presetId);assert.equal(state.fallback,false);assert.equal(state.zone,zone);
      if(live){assert.equal(state.imageReady,true);assert.ok(state.displayedUrl.includes(state.url),'Requested walk image was not painted');}
      assert.deepEqual(state.logicalSize.map(s=>s.trim()),['48px','72px']);
    }
    assert.equal(f.before.changes,f.after.changes);
    await screenshot(gameDirectory,f.filename);
  }
}
const report={characters:12,selectionFrames:192,[{home:'homeGameFrames',neighborhood:'neighborhoodGameFrames','subway-station':'subwayStationGameFrames','subway-train':'subwayTrainGameFrames'}[zone]]:192,zone,currentAssetsVerified:checked.size,viewport:[390,844],passed:true,visualApproved:false,productionServiceWorkerChecked:false,scope:`Capture coverage, stable frames, actual ${zone} direction and translation, screenshot dimensions and current staging hash chain. Does not establish visual quality or other map readability.`};
await writeFile(path.join(base,zone==='home'?`${prefix}-motion-audit.json`:`${prefix}-${zone}-motion-audit.json`),JSON.stringify({...report,productionBuild:production},null,2)+'\n');
console.log(JSON.stringify(report));
