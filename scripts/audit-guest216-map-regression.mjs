import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {guest216MapInputs} from './lib/guest216MapInputs.mjs';
import {compareGuest216MapRegression} from './lib/guest216MapRegression.mjs';

export async function auditGuest216MapRegression(root = new URL('../', import.meta.url)) {
  const json = async file => JSON.parse(await readFile(new URL(file, root)));
  const base = 'character-assets/rigs/common-three-head-216-v1/';
  const report = await json(base + 'map-browser-evidence.json');
  const contract = await json('scripts/visual-baselines/guest216-map-browser-contract.json');
  assert.deepEqual(report.inputs, await guest216MapInputs(root), 'Stale background, foreground, CSS, or measurement code: recapture browser evidence');
  const catalog = await json('character-assets/rigs/guest-cutout-catalog-v1.json');
  assert.deepEqual(report.sourceHashes.map(item => item.id).sort(), catalog.characters.map(item => item.characterId).sort());
  const hash = data => createHash('sha256').update(data).digest('hex');
  for (const source of report.sourceHashes) {
    assert.equal(source.sha256, hash(await readFile(new URL(`character-assets/rigs/${source.id}/three-head-216-v1/review/walk-sheet.png`, root))), `Stale character: ${source.id}`);
  }
  const zones = (await json('map-assets/reference/v2/manifest.json')).zones.map(zone => zone.id);
  assert.equal(report.captures.length, zones.length * 4);
  assert.equal(new Set(report.captures.map(item => `${item.zone}/${item.direction}`)).size, zones.length * 4);
  for (const capture of report.captures) {
    assert.ok(zones.includes(capture.zone) && [0,1,2,3].includes(capture.direction));
    const direction = ['front','left','right','back'][capture.direction];
    assert.equal(capture.file, `map-browser-${capture.zone}-${direction}.png`);
    assert.equal(capture.sha256, hash(await readFile(new URL(base + capture.file, root))), 'Changed visual capture');
  }
  return compareGuest216MapRegression(report, contract);
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await auditGuest216MapRegression();
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
