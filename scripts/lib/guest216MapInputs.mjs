import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DEFAULT_FOREGROUND_PLACEMENTS} from './mapForegroundAuditRenderer.mjs';

// Bind browser measurements to every scene input and the measuring implementation.
// Never trust paths supplied by a saved evidence report to define its own coverage.
export async function guest216MapInputs(root = new URL('../../', import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('map-assets/reference/v2/manifest.json', root)));
  const paths = new Set([
    'map-assets/reference/v2/manifest.json',
    'character-assets/rigs/guest-cutout-catalog-v1.json',
    'client/src/map-visual-enhancements.css',
    'scripts/build-guest-three-head-216-map-review.mjs',
    'scripts/templates/guest216-map-review.js',
    'scripts/lib/mapForegroundAuditRenderer.mjs',
    'scripts/lib/mapToneAudit.mjs',
    'scripts/lib/guest216MapInputs.mjs'
  ]);
  for (const zone of manifest.zones) {
    paths.add(`client/public/assets/maps/v2/${zone.id}/${zone.background.output}`);
    for (const part of DEFAULT_FOREGROUND_PLACEMENTS[zone.id] ?? []) {
      paths.add(`client/public/assets/maps/v2/${zone.id}/${part.asset}`);
    }
  }
  return Promise.all([...paths].sort().map(async file => ({
    file, sha256: createHash('sha256').update(await readFile(new URL(file, root))).digest('hex')
  })));
}
