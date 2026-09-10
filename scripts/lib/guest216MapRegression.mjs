import {displayCalibrationProfiles} from './mapToneAudit.mjs';

export const guest216ContrastLimits = Object.freeze({
  minCharacterEdgeContrast: 1.17,
  minDisplayCharacterEdgeContrast: 1.1,
  maxCharacterEdgeContrastDelta: 0.15
});
export const guest216Profiles = Object.keys(displayCalibrationProfiles).sort();
export const guest216RowKey = row => [row.zone, row.id, row.direction, row.frame].join('/');
export const guest216RowValues = row => [row.edgeContrast, ...guest216Profiles.map(id => row.displayEdgeContrasts?.[id])];

// A new, independently reviewed artwork baseline. The old single-shadow v26
// contract is historical evidence, not a reference image for new anatomy/artwork.
// Absolute limits AND the original 0.15 regression allowance remain unchanged.
export function compareGuest216MapRegression(report, contract) {
  const issues = [];
  if (contract.version !== 1 || contract.model !== 'browser-css-two-shadow-216-v1') issues.push('contract-model-invalid');
  if (JSON.stringify(contract.profiles) !== JSON.stringify(guest216Profiles)) issues.push('profile-contract-invalid');
  for (const [key, limit] of Object.entries(guest216ContrastLimits)) {
    if (contract.thresholds?.[key] !== limit || report.thresholds?.[key] !== limit) issues.push(`threshold-changed:${key}`);
  }
  if (report.fixtureOnly !== true || report.actualGame !== false) issues.push('evidence-scope-invalid');
  const keys = report.rows.map(guest216RowKey);
  if (keys.length !== 1920 || new Set(keys).size !== 1920 || Object.keys(contract.rows).length !== 1920) issues.push('coverage-invalid');
  if (JSON.stringify([...keys].sort()) !== JSON.stringify(Object.keys(contract.rows).sort())) issues.push('coverage-mismatch');
  for (const row of report.rows) {
    const key = guest216RowKey(row), expected = contract.rows[key];
    if (!expected || expected.length !== 7 || expected.some(value => !Number.isFinite(value))) { issues.push(`baseline-invalid:${key}`); continue; }
    if (JSON.stringify(Object.keys(row.displayEdgeContrasts ?? {}).sort()) !== JSON.stringify(guest216Profiles)) issues.push(`profiles-invalid:${key}`);
    guest216RowValues(row).forEach((value, index) => {
      const minimum = index === 0 ? 1.17 : 1.1;
      if (!Number.isFinite(value) || Number(value.toFixed(3)) < minimum) issues.push(`contrast-below-minimum:${key}/${index}`);
      if (Number.isFinite(value) && Math.abs(value - expected[index]) > 0.15) issues.push(`contrast-regression:${key}/${index}`);
    });
  }
  return {passed: issues.length === 0, issues, measurements: report.rows.length};
}
