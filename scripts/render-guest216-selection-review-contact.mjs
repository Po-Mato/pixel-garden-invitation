import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Inspection-only crops of browser screenshots; never modifies character assets.
const root = new URL('../character-assets/rigs/', import.meta.url);
const output = new URL('common-three-head-216-v1/release-review/', root);
await mkdir(output, {recursive: true});
for (let group = 0; group < 3; group++) {
  const layers = [];
  for (let row = 0; row < 4; row++) {
    const id = `guest-${String(group * 4 + row + 1).padStart(2, '0')}`;
    for (const [col, direction] of ['down', 'left', 'right', 'up'].entries()) {
      const input = await sharp(fileURLToPath(new URL(`${id}/three-head-216-v1/review/local-selection-216-production-preview-${direction}.png`, root)))
        .extract({left: 95, top: 235, width: 200, height: 220}).png().toBuffer();
      layers.push({input, left: col * 200, top: row * 220});
    }
  }
  await sharp({create: {width: 800, height: 880, channels: 4, background: '#e8e1d2'}})
    .composite(layers).png().toFile(fileURLToPath(new URL(`selection-${group + 1}.png`, output)));
}
