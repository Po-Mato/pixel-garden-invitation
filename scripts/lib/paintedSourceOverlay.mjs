import assert from 'node:assert/strict';
import sharp from './deterministicSharp.mjs';

// Original-material compositing only, before any rig registration or animation.
// Pin every float32 rounding boundary, including fused multiply/add. Native
// libvips uses compiler vector arithmetic here even when sharp.simd(false).
// Contract reference: libvips v8.17.3 conversion/composite.cpp blend3/combine_pixels3.
// No frame references, region patches, thresholds or character-specific cases.
export function blendPaintedSourcePixels(source, paint, channels) {
  assert.ok(channels === 3 || channels === 4);
  assert.equal(source.length / channels, paint.length / 4);
  const output = Buffer.alloc(source.length);
  const f = Math.fround;
  for (let pixel = 0; pixel < paint.length / 4; pixel++) {
    const src = pixel * channels, layer = pixel * 4;
    const baseAlpha = channels === 4 ? f(source[src + 3] / 255) : 1;
    const paintAlpha = f(paint[layer + 3] / 255);
    const inversePaintAlpha = f(1 - paintAlpha);
    for (let channel = 0; channel < 3; channel++) {
      const base = f(f(source[src + channel] / 255) * baseAlpha);
      const color = f(f(paint[layer + channel] / 255) * paintAlpha);
      // JavaScript binary64 holds the float32 product and sum before the one
      // explicit final float32 rounding, independent of the host CPU's FMA.
      const mixed = f(color + inversePaintAlpha * base);
      const straight = baseAlpha === 0 ? 0 : f(mixed / baseAlpha);
      output[src + channel] = Math.max(0, Math.min(255, Math.trunc(f(straight * 255))));
    }
    if (channels === 4) output[src + 3] = source[src + 3];
  }
  return output;
}

export async function paintOriginalSourcePng(source, overlay) {
  const {data, info} = await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const paint = await sharp(overlay).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([paint.info.width,paint.info.height],[info.width,info.height]);
  return sharp(blendPaintedSourcePixels(data,paint.data,4),{raw:info}).png().toBuffer();
}

export function assertPaintedSourceOverlay(file, bytes, metadata, sourceSize) {
  assert.equal(typeof file, 'string');
  assert.ok(file.endsWith('.svg'), 'Costume overlays must be editable SVG art, never PNG frame repairs');
  assert.equal(metadata.format, 'svg', 'Costume overlay is not vector art');
  assert.equal(metadata.width, sourceSize.width, 'Overlay must use original source coordinates');
  assert.equal(metadata.height, sourceSize.height, 'Overlay must use original source coordinates');
  const svg = bytes.toString('utf8');
  assert.ok(!/<(?:image|foreignObject|script)\b|\b(?:href|xlink:href)\s*=/i.test(svg), 'Overlay must not embed raster patches or external resources');
}
