import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function relative(root, file) {
  const name = path.relative(root, path.resolve(root, file));
  assert.ok(name && !name.startsWith('..') && !path.isAbsolute(name), 'Render dependency must stay inside project');
  return name.split(path.sep).join('/');
}
async function snapshot(root, files) {
  return Promise.all([...new Set(files.map(file => relative(root, file)))].sort().map(async file => ({file, sha256: sha(await readFile(path.resolve(root, file)))})));
}
async function verifyEntries(root, entries) {
  assert.ok(Array.isArray(entries) && entries.length > 0, 'Missing render provenance');
  assert.deepEqual(await snapshot(root, entries.map(entry => entry.file)), entries, 'Stale render inputs or outputs: rebuild from source');
}
export async function verifyPaintedRenderReceipt(root, file, ancestors = new Set()) {
  const name = relative(root, file);
  assert.ok(!ancestors.has(name), 'Cyclic render receipt');
  const next = new Set([...ancestors, name]);
  const receipt = JSON.parse(await readFile(path.resolve(root, name)));
  assert.equal(receipt.version, 1);
  await verifyEntries(root, receipt.inputs);
  await verifyEntries(root, receipt.outputs);
  for (const dependency of receipt.dependencies) await verifyPaintedRenderReceipt(root, dependency, next);
  return receipt;
}
export async function beginPaintedRender(root, inputs, dependencies = []) {
  const names = dependencies.map(file => relative(root, file));
  for (const file of names) await verifyPaintedRenderReceipt(root, file);
  return {version: 1, inputs: await snapshot(root, [...inputs, ...dependencies, 'scripts/lib/deterministicSharp.mjs']), dependencies: names};
}
export async function finishPaintedRender(root, file, receipt, outputs) {
  await verifyEntries(root, receipt.inputs);
  for (const dependency of receipt.dependencies) await verifyPaintedRenderReceipt(root, dependency);
  await writeFile(path.resolve(root, relative(root, file)), JSON.stringify({...receipt, outputs: await snapshot(root, outputs)}, null, 2) + '\n');
}
