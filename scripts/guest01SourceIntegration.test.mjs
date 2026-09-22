import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-01/storybook-source-v1');
const review=path.join(base,'review/balanced-shading-v3'),generated=path.join(base,'generated/balanced-v3');
const json=async f=>JSON.parse(await fs.readFile(f));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('formal editable recipe reproduces all reviewed frame and runtime bytes',async()=>{
 assert.deepEqual(await json(path.join(base,'balanced-source-recipe-v3.json')),await json(path.join(review,'registration.json')));
 await verifyPaintedRenderReceipt(root,path.join(generated,'source-render-receipt.json'));
 for(const f of ['walk.png','walk-runtime.png','walk-game.png','idle.png','idle-runtime.png',...['front','left','right','back'].flatMap(d=>[1,2,3,4].map(n=>`${d}-walk-${n}.png`))])assert.deepEqual(await fs.readFile(path.join(generated,f)),await fs.readFile(path.join(review,f)));
});
test('catalog staging consumes generated source recipe, not a hand-edited review image',async()=>{
 const manifest=await json(path.join(root,'character-assets/generated/storybook-runtime-staging-v1/build-manifest.json'));
 const c=manifest.characters.find(c=>c.characterId==='guest-01');assert.ok(c.source.endsWith('/generated/balanced-v3/walk.png'));assert.equal(c.sourceReceiptVerified,true);
 assert.equal(c.sourceSheetSha256,hash(await fs.readFile(path.join(generated,'walk.png'))));
 for(const [name,source]of [['walk-hd','walk'],['walk-runtime','walk-runtime'],['idle-hd','idle'],['idle-runtime','idle-runtime']])assert.deepEqual(await fs.readFile(path.join(root,`character-assets/generated/storybook-runtime-staging-v1/${c.presetId}/${c.presetId}__${name}.png`)),await fs.readFile(path.join(generated,source+'.png')));
});
test('integration baseline retained eleven selection assets before separately audited catalog refinements',async()=>{
 const before=await json(path.join(review,'client-selection-evidence.json'));
 const snapshot=await json(path.join(root,'character-assets/rigs/storybook-expansion-v1/review/contrast-v4/before-catalog.json'));
 for(const s of before.switched.filter(s=>s.preset!=='feminine-long-wave-dress')){
  const file=new URL(s.url).pathname.replace('/characters/generated/','');assert.ok(file.startsWith('guests/preview/'));
  const c=snapshot.characters.find(c=>c.presetId===s.preset);
  assert.equal(c.outputs.find(o=>o.file===s.preset+'__walk-hd.png').sha256,s.sha256,s.preset);
 }
 for(const [file,h]of (await json(path.join(review,'audit.json'))).protectedHashes)assert.equal(hash(await fs.readFile(path.join(base,file))),h);
});
test('source integration does not grant production deployment approval',async()=>{
 const r=await json(path.join(base,'active-source-recipe.json'));assert.equal(r.scope,'staging-only');assert.equal(r.productionApproved,false);assert.equal(r.runtimeEligible,false);
 const m=await json(path.join(root,'character-assets/generated/storybook-runtime-staging-v1/build-manifest.json'));assert.equal(m.publicAssetsModified,false);assert.equal(m.runtimeEligible,false);
});
