import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generateCharacterAssets} from './generate-character-assets.mjs';

const root = new URL('../', import.meta.url);
const staging = new URL('character-assets/generated/storybook-runtime-staging-v1/', root);
const output = new URL('character-assets/generated/storybook-client-qa-v1/', root);
const manifest = JSON.parse(await readFile(new URL('build-manifest.json', staging)));
assert.equal(manifest.stagingOnly, true);
assert.equal(manifest.runtimeEligible, false);
assert.equal(manifest.publicAssetsModified, false);
assert.equal(manifest.characters.length, 12);
// Validate every staging input before the generator replaces its isolated QA folder.
for (const character of manifest.characters) for (const asset of character.outputs) {
  assert.match(character.presetId, /^[a-z0-9-]+$/);
  assert.match(asset.file, /^[a-z0-9_-]+\.png$/);
  const bytes = await readFile(new URL(`${character.presetId}/${asset.file}`, staging));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `Stale staging file: ${asset.file}`);
}
await generateCharacterAssets({cutoutRoot: fileURLToPath(staging), outputRoot: fileURLToPath(output)});
const copies=[];
for(const c of manifest.characters)for(const kind of ['walk','idle'])for(const preview of [false,true]){
  const source=`${c.presetId}/${c.presetId}__${kind}-${preview?'hd':'runtime'}.png`;
  const target=`guests/${preview?'preview/':''}${c.presetId}__${kind}.png`;
  const a=await readFile(new URL(source,staging)),b=await readFile(new URL(target,output));
  assert.deepEqual(a,b,`QA copy differs from exported source: ${target}`);
  copies.push({source,target,sha256:createHash('sha256').update(b).digest('hex')});
}
await writeFile(new URL('source-copies.json',output),JSON.stringify({stagingOnly:true,copies},null,2)+'\n');
console.log('Isolated storybook client QA package rebuilt; no public asset writes.');
