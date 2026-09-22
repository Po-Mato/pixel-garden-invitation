import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {anchorInputs} from './build-storybook-anchor.mjs';
import {verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='character-assets/rigs/guest-05/';
test('anchor rebuild inputs include hidden materials, mattes, bindings and all shared motion, not generated intermediates',async()=>{
  const inputs=new Set((await anchorInputs()).map(f=>path.relative(root,f)));
  assert.ok([...inputs].every(f=>!f.split(path.sep).includes('generated')));
  for(const f of [
    'storybook-head-study-v1/front-head-candidate.png',
    'storybook-head-matte-v1/hidden-forehead-matte.svg',
    'storybook-head-matte-v1/hidden-back-hair-matte.svg',
    'storybook-head-matte-v1/sources/hidden-forehead-paint-v1.png',
    'storybook-head-matte-v1/sources/hidden-back-hair-paint-v1.png',
    'storybook-body-v1/front-joint-bindings.json',
    'storybook-body-v1/front-registration.json',
    'storybook-directions-v1/head-layers.json',
    'storybook-directions-v1/head-registration.json',
    'storybook-directions-v1/body-registration.json'
  ])assert.ok(inputs.has(base+f),`Missing anchor source: ${f}`);
  for(const d of ['front','left','right','back'])assert.ok(inputs.has(`character-assets/rigs/common-three-head-216-v1/animations/dress-${d}.json`));
});
test('anchor receipt verifies current editable sources and all sixteen freshly rendered frames',async()=>{
  const receipt=await verifyPaintedRenderReceipt(root,base+'storybook-directions-v1/generated/walk-render-receipt.json');
  assert.deepEqual(receipt.inputs.map(i=>i.file),[...(await anchorInputs()).map(f=>path.relative(root,f)),'scripts/lib/deterministicSharp.mjs'].sort());
  const files=new Set(receipt.outputs.map(o=>o.file));
  for(const d of ['front','left','right','back'])for(let n=1;n<=4;n++)assert.ok(files.has(base+(d==='front'?'storybook-body-v1':'storybook-directions-v1')+`/generated/${d}-walk-${n}.png`));
  assert.ok(files.has(base+'storybook-directions-v1/generated/guest05-walk-study.png'));
});
