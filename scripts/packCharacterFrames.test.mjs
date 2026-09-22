import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {packCharacterFrames} from './lib/packCharacterFrames.mjs';

test('whole-frame atlas placement preserves all RGBA values including transparent edges', async () => {
  const raw = Buffer.from([61,41,29,87, 255,254,253,1, 42,24,17,0, 99,88,77,255]);
  const input = await sharp(raw,{raw:{width:2,height:2,channels:4}}).png().toBuffer();
  const packed = await packCharacterFrames(4,2,[{input,left:0,top:0},{input,left:2,top:0}]);
  for (const left of [0,2]) assert.deepEqual(await sharp(packed).extract({left,top:0,width:2,height:2}).raw().toBuffer(), raw);
});
test('atlas rejects overlap and out-of-bounds placement', async () => {
  const input = await sharp({create:{width:2,height:2,channels:4,background:'#fff'}}).png().toBuffer();
  await assert.rejects(packCharacterFrames(2,2,[{input,left:1,top:0}]));
  await assert.rejects(packCharacterFrames(2,2,[{input,left:0,top:0},{input,left:0,top:0}]), /overlap/);
});
