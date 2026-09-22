import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export async function assertStorybookClientQaFresh(root,relative,bytes){
  const qa=path.join(root,'character-assets/generated/storybook-client-qa-v1');
  const staging=path.join(root,'character-assets/generated/storybook-runtime-staging-v1');
  const manifest=JSON.parse(await readFile(path.join(qa,'source-copies.json')));
  const entry=manifest.copies.find(e=>e.target===relative);
  assert.ok(entry,`No source copy receipt: ${relative}`);
  assert.match(entry.source,/^[a-z0-9-]+\/[a-z0-9_-]+\.png$/);
  const hash=b=>createHash('sha256').update(b).digest('hex');
  assert.equal(hash(bytes),entry.sha256,`Stale QA output: ${relative}`);
  assert.equal(hash(await readFile(path.join(staging,entry.source))),entry.sha256,`QA has not been rebuilt from current staging: ${relative}`);
}
