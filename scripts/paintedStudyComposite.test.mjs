import test from 'node:test';
import assert from 'node:assert/strict';
import {compositeStudyPixels, compositeStudyPng} from './lib/paintedStudyComposite.mjs';
import sharp from './lib/deterministicSharp.mjs';

test('whole source layer composition pins fused float32 rounding', () => {
  assert.deepEqual([...compositeStudyPixels([Buffer.from([5,5,5,255]),Buffer.from([39,26,21,30])])],[9,7,6,255]);
});
test('source layers preserve opaque cream and clear fully transparent RGB', () => {
  assert.deepEqual([...compositeStudyPixels([Buffer.from([247,242,224,255,255,255,255,0])])],[247,242,224,255,0,0,0,0]);
  assert.throws(()=>compositeStudyPixels([]));
  assert.throws(()=>compositeStudyPixels([Buffer.alloc(4),Buffer.alloc(8)]));
});
test('source study compositor rejects incompatible canvases', async () => {
  const png=await sharp({create:{width:1,height:1,channels:4,background:'#fff'}}).png().toBuffer();
  await assert.rejects(compositeStudyPng([png],192,288));
});
