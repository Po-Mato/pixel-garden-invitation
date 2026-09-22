import assert from 'node:assert/strict';
import sharp from './deterministicSharp.mjs';

// Assemble whole registered source layers, never patches from finished frames.
// Pin the approved float32 source-over arithmetic independently of native FMA.
export function compositeStudyPixels(layers) {
  assert.ok(layers.length > 0);
  const length = layers[0].length;
  assert.equal(length % 4, 0);
  for (const layer of layers) assert.equal(layer.length, length);
  const output = Buffer.alloc(length), f = Math.fround;
  for (let i = 0; i < length; i += 4) {
    const color = [0, 0, 0];
    let alpha = 0;
    for (const layer of layers) {
      const a = f(layer[i + 3] / 255), inverse = f(1 - a);
      for (let c = 0; c < 3; c++) {
        const premultiplied = f(f(layer[i + c] / 255) * a);
        color[c] = f(premultiplied + inverse * color[c]);
      }
      alpha = f(a + alpha * inverse);
    }
    for (let c = 0; c < 3; c++) output[i + c] = alpha === 0 ? 0 : Math.max(0, Math.min(255, Math.trunc(f(f(color[c] / alpha) * 255))));
    output[i + 3] = Math.max(0, Math.min(255, Math.trunc(f(alpha * 255))));
  }
  return output;
}

export async function compositeStudyPng(inputs, width, height) {
  const layers = [];
  for (const input of inputs) {
    const {data, info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.deepEqual([info.width, info.height, info.channels], [width, height, 4]);
    layers.push(data);
  }
  return sharp(compositeStudyPixels(layers), {raw:{width, height, channels:4}}).png().toBuffer();
}
