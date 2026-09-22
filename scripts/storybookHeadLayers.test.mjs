import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'character-assets/rigs/guest-05/storybook-head-matte-v1');
for (const script of ['render-storybook-head-matte.mjs', 'render-storybook-head-layers.mjs', 'render-storybook-hidden-forehead.mjs', 'render-storybook-hidden-back-hair.mjs']) execFileSync(process.execPath, [path.join(root, 'scripts', script)], { cwd: root });
const raw = async p => sharp(path.join(base, p)).ensureAlpha().raw().toBuffer();
test('all exported layers have zero RGB under fully transparent pixels', async () => {
  for (const name of ['face', 'frontHair', 'backHair']) {
    const data = await raw(`generated/layers/${name}.png`);
    for (let i = 0; i < data.length; i += 4) if (!data[i + 3]) assert.deepEqual([...data.subarray(i, i + 3)], [0, 0, 0]);
  }
});
test('excluded curl outside the face is not re-added by XOR', async () => {
  const data = await raw('generated/layers/face.png');
  for (const [x, y] of [[450, 945], [440, 935], [405, 910]]) assert.equal(data[(y * 1422 + x) * 4 + 3], 0);
});
test('hidden forehead cannot change the locked assembled appearance', async () => {
  assert.deepEqual(await raw('generated/layers/assembled.png'), await raw('generated/hidden-forehead/assembled.png'));
});
test('hidden back hair cannot change locked assembled appearance', async () => {
  assert.deepEqual(await raw('generated/layers/assembled.png'), await raw('generated/complete-head/assembled.png'));
});
test('new hidden skin is opaque at representative forehead and temple points', async () => {
  const data = await raw('generated/hidden-forehead/face-with-hidden-skin.png');
  for (const [x, y] of [[600, 500], [650, 540], [730, 410], [440, 800]]) assert.equal(data[(y * 1422 + x) * 4 + 3], 255);
});
test('partial head prototype does not claim runtime or independent-motion approval', async () => {
  const audit = JSON.parse(await fs.readFile(path.join(base, 'generated/hidden-forehead/audit.json')));
  assert.equal(audit.runtimeEligible, false);
  assert.equal(audit.independentHairMotionApproved, false);
});
