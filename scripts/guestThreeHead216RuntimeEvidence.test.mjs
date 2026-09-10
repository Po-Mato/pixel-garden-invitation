import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../character-assets/rigs/',import.meta.url);
const json=async u=>JSON.parse(await readFile(u));
const hash=b=>createHash('sha256').update(b).digest('hex');
for(let i=1;i<=12;i++)test(`guest-${i} actual staged-runtime movement uses 96px source frames and current reduced bytes`,async()=>{
 const id='guest-'+String(i).padStart(2,'0'),base=new URL(id+'/three-head-216-v1/review/',root);
 const game=await json(new URL('local-game-216-runtime-review.json',base));
 const exports=await json(new URL('../generated/three-head-216-v1/build-manifest.json',root));
 const entry=exports.characters.find(c=>c.characterId===id),output=entry.outputs.find(o=>o.file.endsWith('__walk-runtime.png'));
 assert.equal(game.stagedRuntime,true);assert.equal(game.productionIntegrated,false);assert.equal(game.developmentOnly,true);
 assert.deepEqual(game.sourceFrameSize,[96,144]);assert.deepEqual(game.viewport,[390,844]);
 assert.equal(game.sheetSha256,output.sha256);assert.equal(game.sourceSheetSha256,entry.sourceSheetSha256);
 assert.equal(game.sourceSheetSha256,hash(await readFile(new URL('walk-sheet.png',base))));
 assert.equal(game.rows.length,4);
 for(const r of game.rows){
  const row={down:0,left:1,right:2,up:3}[r.direction],moving=r.samples.filter(s=>s.moving==='true'&&s.direction===r.direction);
  assert.notEqual(row,undefined);assert.deepEqual([...new Set(moving.map(s=>s.frame))].sort(),[0,1,2,3]);
  for(const s of moving){assert.deepEqual(s.size,[48,72]);assert.ok(s.url.includes(`/__guest216-pilot/${id}-runtime.png`));assert.equal(s.sheetPosition,`${s.frame===0?0:-s.frame*96}px ${row===0?0:-row*144}px`);}
  const axis=r.direction==='left'||r.direction==='right'?0:1,delta=moving.at(-1).position[axis]-moving[0].position[axis];
  assert.ok(r.direction==='left'||r.direction==='up'?delta<0:delta>0);
  assert.deepEqual(r.stopped,{direction:r.direction,moving:'false',frame:1});
 }
 assert.equal(game.screenshots.length,4);for(const s of game.screenshots)assert.equal(hash(await readFile(new URL(s.file,base))),s.sha256);
});
for(let i=1;i<=12;i++)test(`guest-${i} actual selection/game evidence matches current 216px sheet`,async()=>{
 const id='guest-'+String(i).padStart(2,'0'),base=new URL(id+'/three-head-216-v1/review/',root);
 const sheetHash=hash(await readFile(new URL('walk-sheet.png',base)));
 const selection=(await json(new URL('common-three-head-216-v1/local-selection-review.json',root))).guests.find(g=>g.id===id);
 assert.ok(selection);assert.equal(selection.response.sha256,sheetHash);assert.equal(selection.response.header,sheetHash);assert.equal(selection.response.cache,'no-store');
 assert.deepEqual([...new Set(selection.observed)].sort(),[0,1,2,3]);assert.deepEqual(selection.stopped,{moving:'false',frame:1});
 for(const s of selection.rows){assert.deepEqual(s.state.size,[96,144]);assert.equal(hash(await readFile(new URL(s.file,base))),s.sha256);}
 const game=await json(new URL('local-game-216-review.json',base));
 assert.equal(game.developmentOnly,true);assert.equal(game.productionIntegrated,false);assert.equal(game.sheetSha256,sheetHash);assert.deepEqual(game.viewport,[390,844]);
 assert.deepEqual(game.rows.map(r=>r.direction),['left','right','up','down']);
 for(const r of game.rows){
  const moving=r.samples.filter(s=>s.moving==='true'&&s.direction===r.direction);
  assert.deepEqual([...new Set(moving.map(s=>s.frame))].sort(),[0,1,2,3]);
  for(const s of moving)assert.deepEqual(s.size,[48,72]);
  assert.deepEqual(r.stopped,{direction:r.direction,moving:'false',frame:1});
 }
 for(const s of game.screenshots)assert.equal(hash(await readFile(new URL(s.file,base))),s.sha256);
});
