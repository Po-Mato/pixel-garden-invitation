import test from 'node:test';
import assert from 'node:assert/strict';
import {alphaConnection,inspectStorybookJointConnections} from './lib/storybookJointConnections.mjs';
import {fileURLToPath} from 'node:url';
test('joint topology distinguishes overlap, edge contact, a gap and a diagonal touch',()=>{
  const a=Buffer.alloc(9);a[4]=255;
  const b=Buffer.alloc(9);b[4]=255;
  assert.equal(alphaConnection(a,b,3,3).overlap,1);
  b[4]=0;b[5]=255;assert.equal(alphaConnection(a,b,3,3).connected,true);
  b[5]=0;b[0]=255;assert.equal(alphaConnection(a,b,3,3).connected,false);
  b[0]=0;assert.equal(alphaConnection(a,b,3,3).pixelsB,0);
});
test('a long skirt cannot pass an empty limb as a visible connection',async()=>{
  const base=fileURLToPath(new URL('../character-assets/rigs/guest-06/storybook-source-v1/',import.meta.url));
  const {connections:pairs,headLayers}=await inspectStorybookJointConnections(base,'right',3);
  assert.ok(headLayers.some(p=>p.id==='head-above-body'));
  for(const p of headLayers)assert.match(p.sha256,/^[a-f0-9]{64}$/);
  const concealed=pairs.filter(p=>p.status==='connected-under-garment');
  assert.equal(concealed.length,2);
  for(const p of concealed){
    assert.match(p.a,/^thigh/);
    assert.equal(p.connected,false,'No visible connection can be inferred from an empty layer');
    assert.equal(p.sourceConnection.connected,true,'The actual animated source must connect before garment visibility');
  }
  assert.ok(pairs.every(p=>p.status==='connected'||p.status==='connected-under-garment'));
});
test('row wrapping and faint antialiasing cannot bridge a disconnected joint',()=>{
  const a=Buffer.from([0,0,255,0,0,0]),b=Buffer.from([0,0,0,255,0,0]);
  assert.equal(alphaConnection(a,b,3,2).connected,false);
  b[1]=127;assert.equal(alphaConnection(a,b,3,2).connected,false);
  assert.throws(()=>alphaConnection(a,b,3,3));
});
