import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {validateStorybookMapEvidence} from './lib/storybookMapEvidence.mjs';
import {displayCalibrationProfiles} from './lib/mapToneAudit.mjs';
const root = new URL('../', import.meta.url);
const json = async file => JSON.parse(await readFile(new URL(file, root)));
const hash = async file => createHash('sha256').update(await readFile(new URL(file, root))).digest('hex');
const evidence = await json('character-assets/rigs/storybook-expansion-v1/map-browser-evidence.json');
const catalog = await json('character-assets/rigs/guest-cutout-catalog-v1.json');
const manifest = await json('map-assets/reference/v2/manifest.json');
const {thresholds} = await json('scripts/visual-baselines/map-tone-contract.json');
assert.equal(evidence.sourceHashes.length, catalog.characters.length);
for (const {characterId, presetId} of catalog.characters) {
  const entries = evidence.sourceHashes.filter(s => s.id === characterId);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sha256, await hash(`character-assets/generated/storybook-runtime-staging-v1/${presetId}/${presetId}__walk-runtime.png`), `Stale asset: ${characterId}`);
}
assert.equal(evidence.cssSha256, await hash('client/src/map-visual-enhancements.css'));
assert.ok(evidence.inputs.length > 0, 'Missing input provenance');
for (const input of evidence.inputs) assert.equal(input.sha256, await hash(input.file), `Stale input: ${input.file}`);
const result = validateStorybookMapEvidence(evidence, {thresholds, characters: catalog.characters.map(c => c.characterId), zones: manifest.zones.map(z => z.id), profiles: Object.keys(displayCalibrationProfiles)});
console.log(JSON.stringify(result, null, 2));
if (!result.contrastPassed) process.exitCode = 1;
