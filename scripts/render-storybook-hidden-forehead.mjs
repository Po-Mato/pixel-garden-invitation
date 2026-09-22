import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'character-assets/rigs/guest-05/storybook-head-matte-v1');
const out = path.join(base, 'generated/hidden-forehead'); await fs.mkdir(out, { recursive: true });
const source = await fs.readFile(path.join(base, 'sources/hidden-forehead-paint-v1.png'));
const mask = await fs.readFile(path.join(base, 'hidden-forehead-matte.svg'));
const { data: rgb, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
assert.equal(info.width, 1422); assert.equal(info.height, 1106);
const alpha = await sharp(mask).ensureAlpha().extractChannel(3).raw().toBuffer();
const front = await fs.readFile(path.join(base, 'generated/layers/frontHair.png'));
const frontAlpha = await sharp(front).ensureAlpha().extractChannel(3).raw().toBuffer();
const face = await fs.readFile(path.join(base, 'generated/layers/face.png'));
const faceAlpha = await sharp(face).ensureAlpha().extractChannel(3).raw().toBuffer();
const back = await fs.readFile(path.join(base, 'generated/layers/backHair.png'));
const rgba = Buffer.alloc(alpha.length * 4); let pixels = 0;
for (let i = 0; i < alpha.length; i++) {
  // This extension is wholly occluded in the locked style: never repaint a visible facial feature.
  if (alpha[i] && frontAlpha[i] === 255 && faceAlpha[i] === 0) {
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = rgb[i * 3 + c];
    rgba[i * 4 + 3] = alpha[i]; pixels++;
  }
}
assert(pixels > 0);
const patch = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
await fs.writeFile(path.join(out, 'forehead.png'), patch);
const blank = () => sharp({ create: { width: info.width, height: info.height, channels: 4, background: '#00000000' } });
const exposed = await blank().composite([{ input: patch }, { input: face }]).png().toBuffer();
await fs.writeFile(path.join(out, 'face-with-hidden-skin.png'), exposed);
const assembled = await blank().composite([{ input: back }, { input: patch }, { input: face }, { input: front }]).png().toBuffer();
await fs.writeFile(path.join(out, 'assembled.png'), assembled);
const previous = await sharp(path.join(base, 'generated/layers/assembled.png')).raw().toBuffer();
assert.deepEqual(await sharp(assembled).raw().toBuffer(), previous);
const tiles = [];
for (const [i, p] of [patch, exposed, assembled].entries()) tiles.push({ input: await sharp(p).resize(355).toBuffer(), left: i * 355, top: 0 });
await sharp({ create: { width: 1065, height: 280, channels: 4, background: '#e4e8dd' } }).composite(tiles).png().toFile(path.join(out, 'review.png'));
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
await fs.writeFile(path.join(out, 'audit.json'), JSON.stringify({ status: 'hidden-forehead-prototype', sourceSha256: hash(source), maskSha256: hash(mask), addedPixels: pixels, lockedAppearanceExactlyUnchanged: true, independentHairMotionApproved: false, runtimeEligible: false }, null, 2) + '\n');
console.log({ addedPixels: pixels, lockedAppearanceExactlyUnchanged: true });
