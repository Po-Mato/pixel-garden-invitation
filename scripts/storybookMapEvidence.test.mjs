import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStorybookMapEvidence} from './lib/storybookMapEvidence.mjs';
const contract = {thresholds: {minCharacterEdgeContrast: 1.17, minDisplayCharacterEdgeContrast: 1.1}, characters: ['guest-01'], zones: ['home'], profiles: ['lcd']};
function fixture() {
  return {fixtureOnly: true, actualGame: false, thresholds: {...contract.thresholds},
    rows: Array.from({length: 16}, (_, n) => ({zone: 'home', id: 'guest-01', direction: Math.floor(n / 4), frame: n % 4, edgeContrast: 1.3, displayEdgeContrasts: {lcd: 1.2}})), belowStandardThreshold: [], belowDisplayThreshold: []};
}
test('complete contrast evidence never grants visual approval', () => {
  assert.deepEqual(validateStorybookMapEvidence(fixture(), contract), {samples: 16, standardFailures: 0, displayFailures: 0, contrastPassed: true, visualApproved: false});
});
test('actual contrast failures prevent passing', () => {
  const e = fixture(); e.rows[0].edgeContrast = 1.05; e.rows[0].displayEdgeContrasts.lcd = 1.04;
  e.belowStandardThreshold = [e.rows[0]]; e.belowDisplayThreshold = [e.rows[0]];
  assert.equal(validateStorybookMapEvidence(e, contract).contrastPassed, false);
});
test('missing or duplicate frames are rejected', () => {
  const e = fixture(); e.rows[1] = {...e.rows[0]};
  assert.throws(() => validateStorybookMapEvidence(e, contract), /Duplicate/);
  e.rows.pop(); assert.throws(() => validateStorybookMapEvidence(e, contract), /coverage/);
});
test('threshold changes and hidden failure summaries are rejected', () => {
  const e = fixture(); e.thresholds.minCharacterEdgeContrast = 1;
  assert.throws(() => validateStorybookMapEvidence(e, contract), /thresholds/);
  const f = fixture(); f.rows[0].edgeContrast = 1.01;
  assert.throws(() => validateStorybookMapEvidence(f, contract), /failure summary/);
});
test('missing display profiles and nonfinite values are rejected', () => {
  const e = fixture(); e.rows[0].displayEdgeContrasts = {};
  assert.throws(() => validateStorybookMapEvidence(e, contract), /profile/);
  const f = fixture(); f.rows[0].edgeContrast = NaN;
  assert.throws(() => validateStorybookMapEvidence(f, contract), /Invalid contrast/);
});
