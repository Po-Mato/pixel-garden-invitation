import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {beginPaintedRender,finishPaintedRender,verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';
async function fixture(t) {
  const root=await mkdtemp(path.join(tmpdir(),'painted-receipt-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'scripts/lib'),{recursive:true});
  await writeFile(path.join(root,'scripts/lib/deterministicSharp.mjs'),await readFile(new URL('./lib/deterministicSharp.mjs',import.meta.url)));
  await writeFile(path.join(root,'source.svg'),'source art');
  await writeFile(path.join(root,'registered.svg'),'registered part');
  await finishPaintedRender(root,'part.json',await beginPaintedRender(root,['source.svg']),['registered.svg']);
  await writeFile(path.join(root,'keys.json'),'keys');
  await writeFile(path.join(root,'sheet.png'),'rendered sheet');
  await finishPaintedRender(root,'walk.json',await beginPaintedRender(root,['keys.json'],['part.json']),['sheet.png']);
  return root;
}
test('fresh source to registered part to walk chain verifies',async t=>{
  const root=await fixture(t);await verifyPaintedRenderReceipt(root,'walk.json');
});
for(const file of ['source.svg','registered.svg','keys.json','sheet.png','scripts/lib/deterministicSharp.mjs'])test(`changing ${file} invalidates the final render`,async t=>{
  const root=await fixture(t);await writeFile(path.join(root,file),'changed');
  await assert.rejects(verifyPaintedRenderReceipt(root,'walk.json'),/Stale render/);
});
test('inputs changed during rendering cannot receive a current receipt',async t=>{
  const root=await fixture(t),start=await beginPaintedRender(root,['source.svg']);
  await writeFile(path.join(root,'source.svg'),'changed mid-render');
  await assert.rejects(finishPaintedRender(root,'bad.json',start,['registered.svg']),/Stale render/);
});
