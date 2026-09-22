import assert from 'node:assert/strict';

export function assertPaintedSourceOverlay(file, bytes, metadata, sourceSize) {
  assert.equal(typeof file, 'string');
  assert.ok(file.endsWith('.svg'), 'Costume overlays must be editable SVG art, never PNG frame repairs');
  assert.equal(metadata.format, 'svg', 'Costume overlay is not vector art');
  assert.equal(metadata.width, sourceSize.width, 'Overlay must use original source coordinates');
  assert.equal(metadata.height, sourceSize.height, 'Overlay must use original source coordinates');
  const svg = bytes.toString('utf8');
  assert.ok(!/<(?:image|foreignObject|script)\b|\b(?:href|xlink:href)\s*=/i.test(svg), 'Overlay must not embed raster patches or external resources');
}
