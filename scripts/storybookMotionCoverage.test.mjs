import test from 'node:test';
import assert from 'node:assert/strict';
import {isCompleteMotionCapture} from './lib/storybookMotionCoverage.mjs';
const ids=Array.from({length:12},(_,i)=>`guest-${String(i+1).padStart(2,'0')}`);
const fixture=()=>ids.flatMap(id=>['down','left','right','up'].map(direction=>({id,direction,captures:[0,1,2,3].map(frame=>({frame}))})));
test('motion capture requires all twelve characters and all sixteen unique frames each',()=>{
  assert.equal(isCompleteMotionCapture(ids,fixture()),true);
  assert.equal(isCompleteMotionCapture(ids,fixture().slice(0,-1)),false);
  assert.equal(isCompleteMotionCapture(ids.slice(0,1),fixture().slice(0,4)),false);
  const duplicate=fixture();duplicate[47]=duplicate[46];
  assert.equal(isCompleteMotionCapture(ids,duplicate),false);
  const missing=fixture();missing[0].captures.pop();
  assert.equal(isCompleteMotionCapture(ids,missing),false);
  const duplicateFrame=fixture();duplicateFrame[0].captures[3]={frame:2};
  assert.equal(isCompleteMotionCapture(ids,duplicateFrame),false);
  const wrongId=fixture();wrongId[0].id='guest-99';
  assert.equal(isCompleteMotionCapture(ids,wrongId),false);
});
