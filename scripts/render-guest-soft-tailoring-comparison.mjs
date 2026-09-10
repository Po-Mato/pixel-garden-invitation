import {execFileSync} from 'node:child_process';
import {mkdir, readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

// Inspection-only crops of actual browser screenshots, never rig parts or output assets.
const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = '4c19619f76f138f5f98976a4289340e9dded4435';
const output = new URL('../character-assets/rigs/common-three-head-216-v1/release-review/', import.meta.url);
await mkdir(output, {recursive: true});
const layers = [];
for (const [row, [id, direction]] of [['03', 'down'], ['03', 'up'], ['04', 'up'], ['09', 'up']].entries()) {
  const file = `character-assets/rigs/guest-${id}/three-head-216-v1/review/local-selection-216-production-preview-${direction}.png`;
  const before = execFileSync('git', ['show', `${baseline}:${file}`], {cwd: root, maxBuffer: 8 * 1024 * 1024});
  const after = await readFile(new URL(`../${file}`, import.meta.url));
  for (const [col, image] of [before, after].entries()) {
    const input = await sharp(image).extract({left: 95, top: 235, width: 200, height: 220}).png().toBuffer();
    layers.push({input, left: col * 200, top: 30 + row * 220});
  }
}
layers.push({input: Buffer.from('<svg width="400" height="30"><rect width="400" height="30" fill="#eee8de"/><g font-family="sans-serif" font-size="16" text-anchor="middle" fill="#283341"><text x="100" y="21">BEFORE</text><text x="300" y="21">AFTER</text></g></svg>'), left: 0, top: 0});
await sharp({create: {width: 400, height: 910, channels: 4, background: '#eee8de'}}).composite(layers).png().toFile(fileURLToPath(new URL('soft-tailoring-before-after.png', output)));
