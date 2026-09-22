import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {packCharacterFrames} from './lib/packCharacterFrames.mjs';
import {verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';

const root = new URL('../', import.meta.url);
const output = new URL('character-assets/generated/storybook-runtime-staging-v1/', root);
const catalog = JSON.parse(await readFile(new URL('character-assets/rigs/guest-cutout-catalog-v1.json', root)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const characters = [];
assert.equal(catalog.characters.length, 12);
assert.equal(new Set(catalog.characters.map(c => c.presetId)).size, 12);

// Isolated QA adapter. Never writes public assets or changes approval flags.
for (const {characterId, presetId} of catalog.characters) {
  const anchor = characterId === 'guest-05';
  const balanced = characterId === 'guest-01';
  if(balanced){const recipe=JSON.parse(await readFile(new URL('character-assets/rigs/guest-01/storybook-source-v1/active-source-recipe.json',root)));assert.equal(recipe.renderer,'guest01-balanced-source-v3');assert.equal(recipe.generatedDirectory,'generated/balanced-v3');assert.equal(recipe.scope,'staging-only');assert.equal(recipe.productionApproved,false);}
  const base = new URL(`character-assets/rigs/${characterId}/${anchor ? 'storybook-directions-v1' : 'storybook-source-v1'}/generated/${balanced?'balanced-v3/':''}`, root);
  const file = balanced ? 'walk.png' : anchor ? 'guest05-walk-study.png' : 'walk-study.png';
  await verifyPaintedRenderReceipt(fileURLToPath(root), fileURLToPath(new URL(balanced?'source-render-receipt.json':'walk-render-receipt.json', base)));
  const high = await readFile(new URL(file, base));
  const metadata = await sharp(high).metadata();
  assert.equal(metadata.width, 768); assert.equal(metadata.height, 1152);
  assert.equal(metadata.channels, 4);
  const audit = JSON.parse(await readFile(new URL(balanced?'audit.json':'walk-audit.json', base)));
  assert.equal(audit.runtimeEligible, false);
  if (!anchor&&!balanced) assert.equal(hash(high), audit.outputHashes[file], `${characterId}: stale sheet hash`);
  const frameHashes = [];
  for (const [row, direction] of ['front', 'left', 'right', 'back'].entries()) {
    const pixels = [];
    for (let column = 0; column < 4; column++) {
      const frame = await sharp(high).extract({left: column * 192, top: row * 288, width: 192, height: 288}).raw().toBuffer();
      const source = anchor && direction === 'front'
        ? new URL(`../../storybook-body-v1/generated/front-walk-${column + 1}.png`, base)
        : new URL(`${direction}-walk-${column + 1}.png`, base);
      if(balanced)assert.equal(hash(await readFile(source)),audit.directions.find(d=>d.direction===direction).frames[column],`${direction}: stale reviewed frame`);
      assert.equal(hash(frame), hash(await sharp(await readFile(source)).raw().toBuffer()), `${characterId}/${direction}/${column}: stale frame`);
      pixels.push(frame); frameHashes.push({direction, frame: column + 1, rgbaSha256: hash(frame)});
    }
    assert.deepEqual(pixels[1], pixels[3]); assert.notDeepEqual(pixels[0], pixels[2]);
  }
  // Complete frames/sheets only. No region repair, mirroring, color removal or body warp.
  const neutral = await sharp(high).extract({left: 192, top: 0, width: 192, height: 288}).png().toBuffer();
  const idle = await packCharacterFrames(384, 288, [{input: neutral, left: 0, top: 0}, {input: neutral, left: 192, top: 0}]);
  const files = {
    [`${presetId}__walk-hd.png`]: high,
    [`${presetId}__idle-hd.png`]: idle,
    [`${presetId}__walk-runtime.png`]: await sharp(high).resize(384, 576).png().toBuffer(),
    [`${presetId}__idle-runtime.png`]: await sharp(idle).resize(192, 144).png().toBuffer()
  };
  const directory = new URL(`${presetId}/`, output); await mkdir(directory, {recursive: true});
  const outputs = [];
  for (const [name, bytes] of Object.entries(files)) {
    await writeFile(new URL(name, directory), bytes); outputs.push({file: name, sha256: hash(bytes)});
  }
  characters.push({characterId, presetId, sourceReceiptVerified: true, source: path.relative(fileURLToPath(root), fileURLToPath(new URL(file, base))).split(path.sep).join('/'), sourceSheetSha256: hash(high), frameHashes, outputs});
}
await writeFile(new URL('build-manifest.json', output), JSON.stringify({pipeline: 'painted-storybook-runtime-staging-v1', stagingOnly: true, runtimeEligible: false, visualApproved: false, publicAssetsModified: false, geometry: {head: 72, body: 144, total: 216, frame: [192, 288]}, characters}, null, 2) + '\n');
console.log('12 painted rigs exported to isolated runtime QA staging; production unchanged.');
// Browser QA must consume this exact export, never a previous isolated copy.
execFileSync(process.execPath,[fileURLToPath(new URL('scripts/build-storybook-client-qa.mjs',root))],{cwd:fileURLToPath(root),stdio:'inherit'});
