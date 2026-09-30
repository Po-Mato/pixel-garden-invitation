import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyPaintedRenderReceipt} from './paintedRenderReceipt.mjs';
import {canonicalBones} from './canonicalCutoutBinding.mjs';

export const canonicalPackageDirectory='character-assets/generated/canonical-216-v1';
export const tailoredIds=['guest-03','guest-04','guest-09','guest-11'];
export const sha256=b=>createHash('sha256').update(b).digest('hex');

// The catalog, not whichever old output happens to exist, selects the source route.
export async function verifyCurrentCharacter(root,id){
 assert.match(id,/^guest-(0[1-9]|1[0-2])$/);
 const read=f=>fs.readFile(path.resolve(root,f)),json=async f=>JSON.parse(await read(f));
 const base=`character-assets/rigs/${id}`,tailored=tailoredIds.includes(id);
 const directory=`${base}/${tailored?'four-direction-review-v1/review':'canonical-binding-v1/walk-review'}`;
 const sheet=`${directory}/walk-sheet.png`,contact=`${directory}/contact.png`;
 const receipt=`${directory}/${tailored?'audit':'walk-render-receipt'}.json`;
 let connections=0;
 if(tailored){
  const review=await json(receipt);
  for(const [f,h]of Object.entries(review.inputs))assert.equal(sha256(await read(f)),h,'Stale review input: '+f);
  for(const [f,h]of Object.entries(review.outputs))assert.equal(sha256(await read(`${directory}/${f}`)),h,'Stale review output: '+f);
  assert.equal(review.directions.length,4);
  for(const d of review.directions){assert.equal(d.frames,4);assert.ok(d.neutralIdentical&&d.oppositePosesDiffer&&d.headShoulderBandFixed);assert.equal(d.footBaseline,270);assert.ok(d.gameCenterDriftPx<=1);}
  for(const version of ['front-walk-v1','side-walk-v2','back-walk-v1']){
   const a=await json(`${base}/${version}/review/audit.json`);
   for(const [f,h]of Object.entries(a.inputs))assert.equal(sha256(await read(f)),h,'Stale source: '+f);
   for(const frame of a.frames){assert.ok(frame.connections.every(c=>c.connected));connections+=frame.connections.length;}
  }
 }else{
  await verifyPaintedRenderReceipt(root,receipt);
  const walk=await json(`${directory}/audit.json`),neutral=await json(`${base}/canonical-binding-v1/review/audit.json`),shared=await json('character-assets/rigs/shared-tailored-216-v1/skeleton.json');
  assert.equal(walk.frames.length,16);assert.equal(neutral.disconnected.length,0);
  for(const f of walk.frames){assert.deepEqual(f.bones,canonicalBones(shared,f.direction));assert.equal(f.baseline,270);assert.ok(f.headShoulderFixed&&f.connections.every(c=>c.connected));connections+=f.connections.length;}
 }
 return {characterId:id,source:sheet,sourceSheetSha256:sha256(await read(sheet)),receipt,receiptSha256:sha256(await read(receipt)),contact,contactSha256:sha256(await read(contact)),connections};
}
