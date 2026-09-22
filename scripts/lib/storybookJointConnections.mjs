import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {readStorybookFrameLayers} from './storybookFrameLayers.mjs';

// Connectivity is a topology check, not a color/beauty score. Diagonal-only
// contact is not a robust skin/cloth connection; require a shared pixel or an
// edge-adjacent pair at the same alpha cutoff used by anatomical geometry QA.
export function alphaConnection(a,b,width=192,height=288) {
  assert.equal(a.length,width*height);assert.equal(b.length,a.length);
  let pixelsA=0,pixelsB=0,overlap=0,adjacent=0;
  for(let i=0;i<a.length;i++){
    if(b[i]>=128)pixelsB++;
    if(a[i]<128)continue;
    pixelsA++;
    if(b[i]>=128){overlap++;continue;}
    const x=i%width,y=Math.floor(i/width);
    if((x>0&&b[i-1]>=128)||(x+1<width&&b[i+1]>=128)||(y>0&&b[i-width]>=128)||(y+1<height&&b[i+width]>=128))adjacent++;
  }
  return {pixelsA,pixelsB,overlap,adjacent,connected:overlap>0||adjacent>0};
}

export async function inspectStorybookJointConnections(base,direction,frameNumber) {
  const {layers,drawable,wrap}=await readStorybookFrameLayers(base,direction,frameNumber);
  const ids=new Set([`torso-${direction}`,`neck-${direction}`,...['Left','Right'].flatMap(side=>['upperArm','forearm','hand','thigh','calf','shoe'].map(id=>id+side))]);
  const alphas=new Map(),underGarment=new Map();
  for(let i=0;i<layers.length;i++)if(ids.has(layers[i].id)){
    alphas.set(layers[i].id,await sharp(wrap(drawable[i])).ensureAlpha().extractChannel(3).raw().toBuffer());
    if(drawable[i].startsWith('<g mask="url(#costume-leg-visibility)">')){
      assert.match(layers[i].id,/^(thigh|calf|shoe)(Left|Right)$/);
      // Diagnostic only: inspect the same source transform before the authored
      // costume visibility mask. No altered frame is saved or used by runtime.
      const unmasked=drawable[i].replace(' mask="url(#costume-leg-visibility)"','');
      underGarment.set(layers[i].id,await sharp(wrap(unmasked)).ensureAlpha().extractChannel(3).raw().toBuffer());
    }
  }
  const pairs=[[`neck-${direction}`,`torso-${direction}`],...['Left','Right'].flatMap(side=>[
    [`torso-${direction}`,`upperArm${side}`],
    [`upperArm${side}`,`forearm${side}`],
    [`forearm${side}`,`hand${side}`],
    [`thigh${side}`,`calf${side}`],
    [`calf${side}`,`shoe${side}`]
  ])];
  const connections=pairs.map(([a,b])=>{
    assert.ok(alphas.has(a)&&alphas.has(b),`Missing required source layer: ${a}/${b}`);
    const result=alphaConnection(alphas.get(a),alphas.get(b));
    if(!result.pixelsA||!result.pixelsB){
      const sourceConnection=alphaConnection(underGarment.get(a)??alphas.get(a),underGarment.get(b)??alphas.get(b));
      return {a,b,...result,sourceConnection,status:sourceConnection.connected?'connected-under-garment':'unobserved-masked-or-empty'};
    }
    return {a,b,...result,status:result.connected?'connected':'disconnected'};
  });
  const headLayers=layers.flatMap((layer,i)=>layer.id.startsWith('head-')?[{id:layer.id,sha256:createHash('sha256').update(drawable[i]).digest('hex')}]:[]);
  assert.ok(headLayers.some(p=>p.id==='head-above-body'),'Missing complete head source');
  return {connections,headLayers};
}
