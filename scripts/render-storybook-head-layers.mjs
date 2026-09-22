import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from './lib/deterministicSharp.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'character-assets/rigs/guest-05/storybook-head-matte-v1');
const configBytes = await fs.readFile(path.join(base, 'head-layers.json'));
const config = JSON.parse(configBytes);
const source = await fs.readFile(path.join(base, '../storybook-head-study-v1/front-head-candidate.png'));
const matte = await fs.readFile(path.join(base, 'head-matte-refined.svg'));
const { data: rgb, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const coverage = await sharp(matte).ensureAlpha().extractChannel(3).raw().toBuffer();
const n = info.width * info.height;
const remaining = Buffer.from(coverage), parts = [], counts = {};
const out = path.join(base, 'generated/layers'); await fs.mkdir(out, { recursive: true });
for (const layer of config.layers) {
  assert.equal(layer.parent, 'head'); assert.deepEqual(layer.pivot, config.sourcePivot);
  // Disjoint visible-surface ownership. Internal edges are rasterized once; exterior AA comes from the source matte.
  // True subtraction: an exclusion outside the face must never add pixels back (evenodd XOR did).
  const region = layer.path ? await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}"><rect width="100%" height="100%" fill="black"/><g shape-rendering="crispEdges"><path fill="white" d="${layer.path}"/>${layer.exclude ? `<path fill="black" d="${layer.exclude}"/>` : ''}</g></svg>`)).removeAlpha().extractChannel(0).raw().toBuffer() : null;
  const alpha = Buffer.alloc(n); let count = 0;
  for (let i = 0; i < n; i++) if (!region || region[i] === 255) { alpha[i] = remaining[i]; remaining[i] = 0; if (alpha[i]) count++; }
  assert(count > 0); counts[layer.id] = count;
  // Canonical transparent export: hidden RGB must not leak the unsplit material into external editors.
  const rgba = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) if (alpha[i]) {
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = rgb[i * 3 + c];
    rgba[i * 4 + 3] = alpha[i];
  }
  const png = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  await fs.writeFile(path.join(out, `${layer.id}.png`), png); parts.push({ png, alpha });
}
assert(remaining.every(x => x === 0));
for (let i = 0; i < n; i++) assert.equal(parts.reduce((s, p) => s + p.alpha[i], 0), coverage[i]);
const tiles = [];
for (let i = 0; i < parts.length; i++) {
  const tile = await sharp(parts[i].png).resize(355).toBuffer();
  tiles.push({ input: tile, left: i * 355, top: 0 });
}
await sharp({ create: { width: 1065, height: 280, channels: 4, background: '#e4e8dd' } }).composite(tiles).png().toFile(path.join(out, 'parts-review.png'));
// Validate the actual exported layers through the image compositor, not the original texture.
const assembled = await sharp({ create: { width: info.width, height: info.height, channels: 4, background: '#00000000' } }).composite(parts.map(p => ({ input: p.png }))).png().toBuffer();
await fs.writeFile(path.join(out, 'assembled.png'), assembled);
const previous = await sharp(path.join(base, 'generated/head.png')).raw().toBuffer();
const combined = await sharp(assembled).raw().toBuffer();
let maxRgbDelta = 0;
for (let i = 0; i < n; i++) {
  assert.equal(combined[i * 4 + 3], previous[i * 4 + 3]);
  if (!previous[i * 4 + 3]) continue;
  for (let c = 0; c < 3; c++) {
    const delta = Math.abs(combined[i * 4 + c] - previous[i * 4 + c]);
    maxRgbDelta = Math.max(maxRgbDelta, delta);
    if (previous[i * 4 + 3] === 255) assert.equal(delta, 0);
  }
}
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
await fs.writeFile(path.join(out, 'audit.json'), JSON.stringify({ status: config.status, sourceSha256: hash(source), configSha256: hash(configBytes), matteSha256: hash(matte), counts, completeCoverage: true, composedAlphaUnchanged: true, opaqueRgbUnchanged: true, maxRgbDelta, independentMotionAllowed: false, runtimeEligible: false }, null, 2) + '\n');
console.log({ counts, completeCoverage: true, composedAlphaUnchanged: true, opaqueRgbUnchanged: true, maxRgbDelta });
