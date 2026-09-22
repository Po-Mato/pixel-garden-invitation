import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'character-assets/rigs/guest-05/storybook-head-matte-v1');
const source = path.join(base, '../storybook-head-study-v1/front-head-candidate.png');
const matte = path.join(base, 'head-matte-refined.svg');
const out = path.join(base, 'generated');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const input = await fs.readFile(source), mask = await fs.readFile(matte);
const { data: rgb, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const alpha = await sharp(mask).ensureAlpha().extractChannel(3).raw().toBuffer();
assert.equal(alpha.length, info.width * info.height);
// Original-part material import: keep RGB verbatim, use the editable source matte for coverage.
// No finished walk frame is read or modified, and no anatomy is rescaled or copied.
const png = await sharp(rgb, { raw: info }).joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toBuffer();
const { data: rendered } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
let opaque = 0, partial = 0;
for (let p = 0; p < alpha.length; p++) {
  for (let c = 0; c < 3; c++) assert.equal(rendered[p * 4 + c], rgb[p * 3 + c]);
  assert.equal(rendered[p * 4 + 3], alpha[p]);
  if (alpha[p] === 255) opaque++;
  else if (alpha[p] > 0) partial++;
}
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'head.png'), png);
const registration = JSON.parse(await fs.readFile(path.join(base, 'head-registration.json')));
const scale = registration.cranialHeight / (registration.sourcePivot[1] - registration.sourceCrownY);
const tx = registration.pivot[0] - registration.sourcePivot[0] * scale;
const ty = registration.pivot[1] - registration.sourcePivot[1] * scale;
const frameSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><image href="data:image/png;base64,${png.toString('base64')}" width="${info.width}" height="${info.height}" transform="translate(${tx} ${ty}) scale(${scale})"/></svg>`;
const frame = await sharp(Buffer.from(frameSvg)).png().toBuffer();
await fs.writeFile(path.join(out, 'head-registration-192x288.png'), frame);
for (const width of [96, 48]) await sharp(frame).resize(width, width * 1.5).png().toFile(path.join(out, `head-registration-${width}x${width * 1.5}.png`));
// Read-only reference comparison: the entire approved original is displayed, not used as rig material.
const reference = await sharp(path.join(base, '../storybook-concept-v1/front-concept.png')).resize(410).toBuffer();
const comparedHead = await sharp(png).resize(238).toBuffer();
await sharp({ create: { width: 820, height: 650, channels: 4, background: '#ffffff' } }).composite([{ input: reference, left: 0, top: 20 }, { input: comparedHead, left: 491, top: 90 }]).png().toFile(path.join(out, 'reference-comparison.png'));
const panels = [];
// Whole-image uniform scaling only; source silhouette height is approximately 908px.
for (const [i, bg] of ['#ffffff', '#26343e', '#87996e'].entries()) {
  for (const [j, height] of [288, 72, 36, 18].entries()) {
    const width = Math.round(info.width * height / 908);
    const tile = await sharp(png).resize({ width }).toBuffer();
    const panel = await sharp({ create: { width: 470, height: 380, channels: 4, background: bg } }).composite([{ input: tile, left: Math.round((470 - width) / 2), top: 0 }]).png().toBuffer();
    panels.push({ input: panel, left: i * 470, top: j * 380 });
  }
}
await sharp({ create: { width: 1410, height: 1520, channels: 4, background: '#ffffff' } }).composite(panels).png().toFile(path.join(out, 'review.png'));
assert.equal(hash(await fs.readFile(source)), hash(input));
await fs.writeFile(path.join(out, 'audit.json'), JSON.stringify({ status: 'source-matte-prototype-not-runtime', sourceSha256: hash(input), matteSha256: hash(mask), outputSha256: hash(png), width: info.width, height: info.height, opaque, partial, rgbUnchanged: true, alphaExactlyFromEditableMatte: true, visualApproved: false }, null, 2) + '\n');
console.log({ opaque, partial, rgbUnchanged: true, output: out });
