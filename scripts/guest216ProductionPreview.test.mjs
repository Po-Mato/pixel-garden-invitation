import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root = new URL('../', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(new URL(path, root)));
const catalog = await json('character-assets/rigs/guest-cutout-catalog-v1.json');
const selected = await json('character-assets/rigs/common-three-head-216-v1/local-selection-production-preview-review.json');
for (const c of catalog.characters) test(`${c.characterId}: normal production-preview selection/game and served bytes`, async () => {
  const base = `character-assets/rigs/${c.characterId}/three-head-216-v1/review/`;
  const report = await json(base + 'local-game-216-production-preview-review.json');
  assert.equal(report.productionPreview, true);
  assert.equal(report.remoteProductionVerified, false);
  assert.deepEqual(report.viewport, [390,844]);
  assert.deepEqual(report.sourceFrameSize, [96,144]);
  assert.equal(report.sourceSheetSha256, hash(await readFile(new URL(base + 'walk-sheet.png', root))));
  assert.equal(report.sheetSha256, hash(await readFile(new URL(`client/public/characters/generated/guests/${c.presetId}__walk.png`,root))));
  assert.equal(report.response.status, 200);
  assert.equal(report.response.sha256, report.sheetSha256);
  assert.equal(new URL(report.response.controller).origin, 'http://127.0.0.1:5198');
  assert.equal(report.rows.length, 4);
  assert.deepEqual(report.rows.map(row => row.direction).sort(), ['down','left','right','up']);
  for (const row of report.rows) {
    const moving = row.samples.filter(sample => sample.moving === 'true' && sample.direction === row.direction);
    assert.deepEqual([...new Set(moving.map(sample => sample.frame))].sort(), [0,1,2,3]);
    for (const sample of moving) {
      assert.deepEqual(sample.size, [48,72]);
      assert.ok(sample.url.includes(`characters/generated/guests/${c.presetId}__walk.png?v=guest-soft-tailoring-v1-20260911`));
      assert.ok(!sample.url.includes('__guest216-pilot'));
    }
    assert.deepEqual(row.stopped, {direction:row.direction,moving:'false',frame:1});
  }
  assert.equal(report.screenshots.length, 4);
  for (const item of report.screenshots) assert.equal(item.sha256, hash(await readFile(new URL(base + item.file,root))));
  assert.equal(selected.productionPreview, true);
  assert.equal(selected.previewCssSha256,hash(await readFile(new URL('client/src/entry-screen-v3.css',root))),'Selection layout changed; recapture current browser evidence');
  assert.equal(selected.guests.length,12);
  const selection = selected.guests.find(guest => guest.id === c.characterId);
  assert.equal(selection.response.sha256, report.sourceSheetSha256);
  assert.equal(selection.response.status,200);
  assert.deepEqual([...new Set(selection.observed)].sort(),[0,1,2,3]);
  assert.deepEqual(selection.stopped,{moving:'false',frame:1});
  assert.deepEqual(selection.rows.map(row=>row.state.direction).sort(),['down','left','right','up']);
  for (const item of selection.rows) {
    item.state.size.forEach((value,index)=>assert.ok(Math.abs(value-[160,240][index])<0.01));
    const kind=item.state.direction==='down'?'idle':'walk';
    assert.ok(item.state.url.includes(`characters/generated/guests/preview/${c.presetId}__${kind}.png?v=guest-soft-tailoring-v1-20260911`));
    assert.equal(item.sha256,hash(await readFile(new URL(base+item.file,root))));
  }
});
