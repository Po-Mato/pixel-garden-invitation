import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
const root = new URL('../', import.meta.url);
const json = async file => JSON.parse(await readFile(new URL(file, root)));
const catalog = await json('character-assets/rigs/guest-cutout-catalog-v1.json');
const generatedRoot = 'character-assets/generated/storybook-runtime-staging-v1/';

test('the retained twelve-guest skeleton contract is exactly 72/144/216', async () => {
  assert.equal(catalog.characters.length, 12);
  assert.deepEqual([...new Set(catalog.characters.map(c => c.template))].sort(), ['dress','femaleHanbok','maleHanbok','skirt','tailored']);
  const skeleton = await json('character-assets/rigs/common-three-head-216-v1/skeleton.json');
  assert.deepEqual([skeleton.geometry.headHeight, skeleton.geometry.bodyHeight, skeleton.geometry.characterHeight], [72,144,216]);
  for (const c of catalog.characters) for (const direction of ['front','left','right','back']) {
    const base = new URL(`character-assets/rigs/${c.characterId}/three-head-216-v1/`, root);
    const rig = JSON.parse(await readFile(new URL(`${direction}-rig.json`, base)));
    assert.equal(new URL(rig.skeleton, base).href, new URL('character-assets/rigs/common-three-head-216-v1/skeleton.json', root).href);
    for (const part of Object.values(rig.parts ?? {})) {
      assert.notEqual(part.mirrored, true, `${c.characterId}/${direction}`);
      if (part.file) await readFile(new URL(part.file, base));
    }
  }
});

test('active export has twelve guests, 192 frames and unchanged output sizes', async () => {
  const manifest = await json(generatedRoot + 'build-manifest.json');
  assert.equal(manifest.pipeline, 'painted-storybook-runtime-staging-v1');
  assert.equal(manifest.characters.length, 12);
  for (const c of catalog.characters) {
    const entry = manifest.characters.find(e => e.characterId === c.characterId);
    assert.equal(entry.sourceReceiptVerified, true);
    assert.equal(entry.frameHashes.length, 16);
    for (const [name,width,height] of [['walk-hd',768,1152],['walk-runtime',384,576]]) {
      const meta = await sharp(await readFile(new URL(`${generatedRoot}${c.presetId}/${c.presetId}__${name}.png`,root))).metadata();
      assert.deepEqual([meta.width,meta.height], [width,height]);
    }
  }
});

test('normal selection and game paths contain the exact new whole-frame generated assets', async () => {
  for (const c of catalog.characters) for (const kind of ['walk','idle']) for (const [suffix,folder] of [['hd','guests/preview'],['runtime','guests']]) {
    const source = new URL(`${generatedRoot}${c.presetId}/${c.presetId}__${kind}-${suffix}.png`,root);
    const target = new URL(`client/public/characters/generated/${folder}/${c.presetId}__${kind}.png`,root);
    assert.deepEqual(await readFile(target),await readFile(source),`${c.characterId}/${kind}/${suffix}`);
  }
});
