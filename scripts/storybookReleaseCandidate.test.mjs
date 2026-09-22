import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateStorybookCandidate,verifyStorybookCandidate,storybookCandidateFile} from './lib/storybookReleaseCandidate.mjs';
const root=new URL('../',import.meta.url);
const candidate=JSON.parse(await readFile(new URL(storybookCandidateFile,root)));
const catalog=JSON.parse(await readFile(new URL('character-assets/rigs/guest-cutout-catalog-v1.json',root)));
test('candidate binds twelve current rendered sources and individually inspected evidence',async()=>{
  await verifyStorybookCandidate(fileURLToPath(root));
});
test('passing contrast cannot stand in for actual visual inspection',()=>{
  assert.throws(()=>validateStorybookCandidate({...candidate,visualInspectionPassed:false},catalog));
});
test('incomplete, duplicate or mismatched characters cannot be promoted',()=>{
  for(const modify of [c=>c.characters.pop(),c=>c.characters[1]=c.characters[0],c=>c.characters[0].presetId='other',c=>c.characters[0].outputs.pop()]){
    const changed=structuredClone(candidate);modify(changed);assert.throws(()=>validateStorybookCandidate(changed,catalog));
  }
});
test('failed map gates and missing individual contact sheets remain release blockers',()=>{
  for(const modify of [c=>c.gates.standardContrastFailures=1,c=>c.gates.displayContrastFailures=1,c=>c.inspectedContactSheets=c.inspectedContactSheets.filter(s=>!s.file.endsWith('/client-selection-motion-v1/guest-03-contact.png'))]){
    const changed=structuredClone(candidate);modify(changed);assert.throws(()=>validateStorybookCandidate(changed,catalog));
  }
});
