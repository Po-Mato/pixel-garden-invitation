import assert from 'node:assert/strict';

// Research contrast evidence is necessary, but never sufficient for visual approval.
export function validateStorybookMapEvidence(evidence, {thresholds, characters, zones, profiles}) {
  assert.equal(evidence.fixtureOnly, true);
  assert.equal(evidence.actualGame, false);
  assert.deepEqual(evidence.thresholds, thresholds, 'Contrast thresholds changed');
  const expected = new Set(zones.flatMap(zone => characters.flatMap(id =>
    Array.from({length: 4}, (_, direction) => Array.from({length: 4}, (_, frame) =>
      `${zone}/${id}/${direction}/${frame}`)).flat())));
  assert.equal(evidence.rows.length, expected.size, 'Incomplete map coverage');
  const standard = [], display = [];
  for (const row of evidence.rows) {
    const key = `${row.zone}/${row.id}/${row.direction}/${row.frame}`;
    assert.ok(expected.delete(key), `Duplicate or unknown sample: ${key}`);
    assert.ok(Number.isFinite(row.edgeContrast) && row.edgeContrast >= 1, `Invalid contrast: ${key}`);
    assert.deepEqual(Object.keys(row.displayEdgeContrasts).sort(), [...profiles].sort(), `Missing display profile: ${key}`);
    assert.ok(Object.values(row.displayEdgeContrasts).every(v => Number.isFinite(v) && v >= 1), `Invalid display contrast: ${key}`);
    // Match the existing canonical three-decimal comparison, without relaxing it.
    if (Number(row.edgeContrast.toFixed(3)) < thresholds.minCharacterEdgeContrast) standard.push(row);
    if (Object.values(row.displayEdgeContrasts).some(v => Number(v.toFixed(3)) < thresholds.minDisplayCharacterEdgeContrast)) display.push(row);
  }
  assert.deepEqual(evidence.belowStandardThreshold, standard, 'Stale standard failure summary');
  assert.deepEqual(evidence.belowDisplayThreshold, display, 'Stale display failure summary');
  return {samples: evidence.rows.length, standardFailures: standard.length, displayFailures: display.length,
    contrastPassed: standard.length === 0 && display.length === 0, visualApproved: false};
}
