import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {assertStorybookClientQaFresh} from './lib/storybookClientQaFreshness.mjs';
test('all 48 actual-client walk/idle copies match the current export',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const dir=path.join(root,'character-assets/generated/storybook-client-qa-v1');
  const m=JSON.parse(await fs.readFile(path.join(dir,'source-copies.json')));
  assert.equal(m.copies.length,48);assert.equal(new Set(m.copies.map(c=>c.target)).size,48);
  for(const e of m.copies)await assertStorybookClientQaFresh(root,e.target,await fs.readFile(path.join(dir,e.target)));
});
test('stale staging and changed served bytes are rejected independently',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'storybook-qa-fresh-'));
  try{
    const qa=path.join(root,'character-assets/generated/storybook-client-qa-v1');
    const staging=path.join(root,'character-assets/generated/storybook-runtime-staging-v1/preset');
    await fs.mkdir(qa,{recursive:true});await fs.mkdir(staging,{recursive:true});
    const bytes=Buffer.from('first-source'),target='guests/preset__walk.png';
    await fs.writeFile(path.join(staging,'preset__walk-runtime.png'),bytes);
    await fs.writeFile(path.join(qa,'source-copies.json'),JSON.stringify({copies:[{source:'preset/preset__walk-runtime.png',target,sha256:createHash('sha256').update(bytes).digest('hex')}]}));
    await assertStorybookClientQaFresh(root,target,bytes);
    await assert.rejects(assertStorybookClientQaFresh(root,target,Buffer.from('changed-output')),/Stale QA output/);
    await fs.writeFile(path.join(staging,'preset__walk-runtime.png'),'next-source');
    await assert.rejects(assertStorybookClientQaFresh(root,target,bytes),/not been rebuilt/);
    await assert.rejects(assertStorybookClientQaFresh(root,'guests/missing.png',bytes),/No source copy receipt/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
