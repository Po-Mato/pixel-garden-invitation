import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyPaintedRenderReceipt} from './paintedRenderReceipt.mjs';

export const storybookStagingDirectory='character-assets/generated/storybook-runtime-staging-v1';
export const storybookCandidateFile='character-assets/rigs/storybook-expansion-v1/review/release-candidate-v1.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export function validateStorybookCandidate(candidate,catalog){
  assert.equal(candidate.version,1);
  assert.equal(candidate.scope,'local-rendered-candidate');
  assert.equal(candidate.visualInspectionPassed,true,'A numerical pass is not visual approval');
  assert.deepEqual(candidate.geometry,{head:72,body:144,total:216,frame:[192,288]});
  assert.equal(candidate.characters.length,12);
  assert.deepEqual(candidate.characters.map(c=>c.characterId).sort(),catalog.characters.map(c=>c.characterId).sort());
  assert.equal(new Set(candidate.characters.map(c=>c.presetId)).size,12);
  for(const c of candidate.characters){
    assert.equal(catalog.characters.find(p=>p.characterId===c.characterId).presetId,c.presetId);
    assert.equal(c.outputs.length,4);
    assert.deepEqual(c.outputs.map(o=>o.file).sort(),['walk-hd','walk-runtime','idle-hd','idle-runtime'].map(k=>`${c.presetId}__${k}.png`).sort());
    for(const o of c.outputs)assert.match(o.sha256,/^[a-f0-9]{64}$/);
  }
  for(const id of candidate.characters.map(c=>c.characterId))for(const folder of ['client-selection-motion-v1','client-game-motion-v1']){
    assert.equal(candidate.inspectedContactSheets.filter(s=>s.file.endsWith(`/${folder}/${id}-contact.png`)).length,1,'Missing individually inspected character');
  }
  assert.equal(candidate.gates.mapCompositeSamples,1920);
  assert.equal(candidate.gates.standardContrastFailures,0);
  assert.equal(candidate.gates.displayContrastFailures,0);
  assert.deepEqual(candidate.gates.gameZones,['home','neighborhood','subway-station','subway-train']);
  assert.equal(candidate.gates.selectionFrames,192);
  assert.equal(candidate.gates.gameFramesPerZone,192);
  assert.ok(candidate.evidence.length>=12);
}

export async function verifyStorybookCandidate(root){
  const read=async file=>readFile(path.join(root,file));
  const json=async file=>JSON.parse(await read(file));
  const candidate=await json(storybookCandidateFile);
  validateStorybookCandidate(candidate,await json('character-assets/rigs/guest-cutout-catalog-v1.json'));
  const manifest=await json(`${storybookStagingDirectory}/build-manifest.json`);
  assert.equal(manifest.stagingOnly,true);
  assert.equal(manifest.characters.length,12);
  for(const c of candidate.characters){
    const current=manifest.characters.find(p=>p.characterId===c.characterId);
    for(const key of ['presetId','source','sourceSheetSha256','outputs'])assert.deepEqual(current[key],c[key],`${c.characterId}: candidate no longer matches rendered source`);
    assert.equal(sha(await read(c.source)),c.sourceSheetSha256);
    await verifyPaintedRenderReceipt(root,path.join(path.dirname(c.source),'walk-render-receipt.json'));
    for(const o of c.outputs)assert.equal(sha(await read(`${storybookStagingDirectory}/${c.presetId}/${o.file}`)),o.sha256,'Changed candidate output');
  }
  for(const e of [...candidate.evidence,...candidate.inspectedContactSheets]){
    assert.ok(e.file.startsWith('character-assets/rigs/storybook-expansion-v1/')&&!e.file.split('/').includes('..'));
    assert.equal(sha(await read(e.file)),e.sha256,`Changed reviewed evidence: ${e.file}`);
  }
  return candidate;
}
