import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await fs.readFile(path.join(root, 'character-assets/rigs/guest-cutout-catalog-v1.json')));
const ids = catalog.characters.map(c => c.characterId);
assert.equal(ids.length, 12);
assert.equal(new Set(ids).size, 12);
assert.ok(ids.includes('guest-05'));
const failed = [];
for (const id of ids.filter(id => id !== 'guest-05')) {
  assert.match(id, /^guest-\d{2}$/);
  console.log(`\nSource and shared-motion checks: ${id}`);
  const result = spawnSync(process.execPath, ['--test', 'scripts/storybookSourceStudy.test.mjs'], {
    cwd: root, env: {...process.env, STORYBOOK_GUEST_ID: id}, stdio: 'inherit'
  });
  if (result.error || result.status !== 0) failed.push(id);
}
// The anchor has a distinct source pipeline. Its receipt and all sixteen frames
// are verified by the common structure suite, not by another guest's fixture.
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json')));
const structure = pkg.scripts['characters:storybook:test-structure'];
assert.ok(structure.startsWith('node --test '));
const files = structure.slice('node --test '.length).split(' ');
assert.ok(files.every(file => /^scripts\/[A-Za-z0-9]+\.test\.mjs$/.test(file)));
const result = spawnSync(process.execPath, ['--test', ...files], {cwd: root, stdio: 'inherit'});
if (result.error || result.status !== 0) failed.push('catalog-structure-and-anchor');
const joints = spawnSync(process.execPath, ['scripts/audit-storybook-joint-connections.mjs'], {cwd: root, stdio: 'inherit'});
if (joints.error || joints.status !== 0) failed.push('catalog-joint-connections-and-rigid-heads');
console.log(JSON.stringify({sourceStudies: ids.length - 1, anchorCheckedByStructure: 'guest-05', jointAuditCharacters: ids.length, failed, visualApprovalGranted: false}));
if (failed.length) process.exitCode = 1;
