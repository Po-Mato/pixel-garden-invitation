import sharp from './deterministicSharp.mjs';
import assert from 'node:assert/strict';

// Lossless placement of complete, non-overlapping RGBA frames into an atlas.
// Alpha compositing over transparent black can round edge RGB; no blending is needed here.
export async function packCharacterFrames(width, height, frames) {
  assert.ok(Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0);
  const pixels = Buffer.alloc(width * height * 4);
  const rectangles = [];
  for (const {input, left, top} of frames) {
    const {data, info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    assert.equal(info.channels, 4);
    assert.ok(Number.isInteger(left) && Number.isInteger(top) && left >= 0 && top >= 0);
    assert.ok(left + info.width <= width && top + info.height <= height);
    assert.ok(rectangles.every(r => left >= r.right || left + info.width <= r.left || top >= r.bottom || top + info.height <= r.top), 'Atlas frames must not overlap');
    rectangles.push({left, top, right: left + info.width, bottom: top + info.height});
    for (let y = 0; y < info.height; y++) data.copy(pixels, ((top + y) * width + left) * 4, y * info.width * 4, (y + 1) * info.width * 4);
  }
  return sharp(pixels, {raw: {width, height, channels: 4}}).png().toBuffer();
}
