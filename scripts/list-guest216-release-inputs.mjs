import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Read-only inventory: no staging or deletion. Excludes embedded-image SVG renders.
const root = fileURLToPath(new URL('../', import.meta.url));
const files = new Set();
async function add(file) {
  const absolute = path.resolve(root, file);
  if (!absolute.startsWith(root)) throw new Error(`Outside project: ${file}`);
  const info = await stat(absolute);
  if (info.isDirectory()) {
    for (const entry of await readdir(absolute)) {
      if (entry === '.DS_Store' || entry === 'generated') continue;
      await add(path.join(file, entry));
    }
  } else files.add(path.relative(root, absolute));
}
await add('character-assets/rigs/common-three-head-216-v1');
await add('character-assets/rigs/guest-cutout-catalog-v1.json');
// Retained original pilot regression fixtures and their inherited source dependencies.
for (const dir of ['common-three-head-v1', 'templates', ...[1,2,3].map(n => `guest-03/navy-suit-v${n}`)]) {
  await add(`character-assets/rigs/${dir}`);
}
for (let i = 1; i <= 12; i++) {
  const base = `character-assets/rigs/guest-${String(i).padStart(2, '0')}/three-head-216-v1`;
  await add(base);
  for (const direction of ['front', 'left', 'right', 'back']) {
    const rig = JSON.parse(await readFile(path.join(root, base, `${direction}-rig.json`)));
    async function sources(value) {
      if (!value || typeof value !== 'object') return;
      if (typeof value.file === 'string') await add(path.join(base, value.file));
      for (const nested of Object.values(value)) await sources(nested);
    }
    await sources(rig);
  }
}
if (process.argv.includes('--json')) {
  const inventory = await Promise.all([...files].sort().map(async file => ({file, bytes: (await stat(path.join(root, file))).size})));
  console.log(JSON.stringify({files: inventory, bytes: inventory.reduce((n,f) => n + f.bytes, 0)}, null, 2));
} else process.stdout.write([...files].sort().join('\0') + '\0');
