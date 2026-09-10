import {copyFile, mkdir, readFile, writeFile, constants} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Preserve the previous baseline and failed comparison before intentional art approval.
const root = new URL('../', import.meta.url);
const output = new URL('character-assets/rigs/common-three-head-216-v1/release-review/legacy-baseline/', root);
await mkdir(output, {recursive: true});
const sources = [
  'scripts/visual-baselines/mobile-game-visual-regression.webp',
  'scripts/visual-baselines/mobile-game-visual-regression.json',
  '.superpowers/visual-regression/mobile-game-current.png',
  '.superpowers/visual-regression/mobile-game-diff.png',
  '.superpowers/visual-regression/mobile-game-regions.json',
];
const files = [];
for (const source of sources) {
  const file = source.split('/').at(-1);
  const bytes = await readFile(new URL(source, root));
  await copyFile(new URL(source, root), new URL(file, output), constants.COPYFILE_EXCL);
  files.push({source, file, sha256: createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(new URL('archive.json', output), JSON.stringify({
  archivedAt: new Date().toISOString(),
  reason: 'Preserve old artwork baseline and failed comparison before reviewed 72/144/216 cutout migration. Thresholds unchanged.',
  files,
}, null, 2) + '\n', {flag: 'wx'});
