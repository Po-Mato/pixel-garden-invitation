import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compareGuest216MapRegression} from './lib/guest216MapRegression.mjs';
import {auditGuest216MapRegression} from './audit-guest216-map-regression.mjs';
const json = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url)));
const report = await json('character-assets/rigs/common-three-head-216-v1/map-browser-evidence.json');
const contract = await json('scripts/visual-baselines/guest216-map-browser-contract.json');
test('current 1920 browser measurements and all scene inputs match the separate reviewed contract', async () => {
  assert.deepEqual((await auditGuest216MapRegression()).issues, []);
});
for (const [name, mutate] of [
  ['lower absolute contrast', r => { r.rows[0].edgeContrast = 1.16; }],
  ['lower calibrated contrast', r => { r.rows[0].displayEdgeContrasts.oled = 1.09; }],
  ['regression above unchanged 0.15 allowance', r => { r.rows[0].edgeContrast += .16; }],
  ['missing frame', r => { r.rows.pop(); }],
  ['duplicate frame', r => { r.rows[1] = structuredClone(r.rows[0]); }],
  ['non-finite measurement', r => { r.rows[0].edgeContrast = NaN; }],
  ['missing display profile', r => { delete r.rows[0].displayEdgeContrasts.oled; }],
  ['relaxed threshold', r => { r.thresholds.minCharacterEdgeContrast = 1; }]
]) test('rejects ' + name, () => {
  const changed = structuredClone(report); mutate(changed);
  assert.equal(compareGuest216MapRegression(changed, contract).passed, false);
});
