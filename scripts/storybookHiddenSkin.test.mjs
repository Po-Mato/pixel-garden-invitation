import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-03/storybook-source-v1');
const config=JSON.parse(await fs.readFile(path.join(base,'head-layers.json')));
const rgba=file=>sharp(file).ensureAlpha().raw().toBuffer();
test('reviewed forehead hair landmarks belong to hair, while adjacent left forehead skin remains face-owned',async()=>{
  const landmarks={front:[[810,466],[875,474],[936,504]],left:[[617,449],[638,480]]};
  for(const [direction,points] of Object.entries(landmarks)){
    const out=path.join(base,'generated/head-layers',direction);
    const visible=await rgba(path.join(out,'face-visible.png'));
    const hair=await rgba(path.join(out,'frontHair.png'));
    const {width}=await sharp(path.join(out,'face-visible.png')).metadata();
    for(const [x,y]of points){const p=(y*width+x)*4;assert.equal(visible[p+3],0,`${direction}: hair fragment remains face-owned`);assert.equal(hair[p+3],255);}
    if(direction==='left')assert.equal(visible[(437*width+534)*4+3],255,'Do not remove adjacent skin to clean the hair boundary');
  }
});
test('left nose and jaw contours belong to face without taking the adjacent nape hair',async()=>{
  const out=path.join(base,'generated/head-layers/left');
  const face=await rgba(path.join(out,'face-visible.png'));
  const hair=await rgba(path.join(out,'backHair.png'));
  const {width}=await sharp(path.join(out,'face-visible.png')).metadata();
  for(const [x,y]of [[610,991],[700,967],[333,810]]){
    const p=(y*width+x)*4;
    assert.equal(face[p+3],255,'Reviewed nose/jaw source contour must remain face-owned');
    assert.equal(hair[p+3],0,'Face contour must not remain in back hair');
  }
  const nape=(945*width+780)*4;
  assert.equal(face[nape+3],0,'Do not expand the face across real nape hair');
  assert.equal(hair[nape+3],255);
});
for(const [direction,definition] of Object.entries(config.directions)){
  for(const hidden of definition.hiddenSurfaces||[]){
    test(`${direction}: hidden skin only occupies explicitly covered empty source regions`,async()=>{
      const out=path.join(base,'generated/head-layers',direction);
      const visible=await rgba(path.join(out,`${hidden.target}-visible.png`));
      const extended=await rgba(path.join(out,`${hidden.target}.png`));
      const skin=await rgba(path.join(out,`${hidden.id}.png`));
      const source=await rgba(path.join(base,hidden.source));
      const mask=await sharp(path.join(base,hidden.matte)).ensureAlpha().extractChannel(3).raw().toBuffer();
      const covers=await Promise.all(hidden.occludedBy.map(id=>rgba(path.join(out,`${id}.png`))));
      let additions=0;
      for(let p=0;p<mask.length;p++){
        const i=p*4, expected=mask[p]>0&&visible[i+3]===0&&covers.some(c=>c[i+3]===255);
        assert.equal(skin[i+3]>0,expected,`unexpected source coverage at ${p}`);
        if(expected){
          additions++;
          assert.equal(skin[i+3],mask[p]);
          assert.deepEqual(skin.subarray(i,i+3),source.subarray(i,i+3));
          assert.deepEqual(extended.subarray(i,i+4),skin.subarray(i,i+4));
        }else assert.deepEqual(extended.subarray(i,i+4),visible.subarray(i,i+4));
      }
      assert.ok(additions>0);
    });
    test(`${direction}: hidden skin does not change the assembled head, including antialiased edges`,async()=>{
      const out=path.join(base,'generated/head-layers',direction);
      const meta=await sharp(path.join(out,'assembled.png')).metadata();
      const inputs=await Promise.all(definition.layers.map(async layer=>({input:await fs.readFile(path.join(out,`${layer.id===hidden.target?layer.id+'-visible':layer.id}.png`))})));
      const original=await sharp({create:{width:meta.width,height:meta.height,channels:4,background:'#00000000'}}).composite(inputs).raw().toBuffer();
      assert.deepEqual(await rgba(path.join(out,'assembled.png')),original);
    });
  }
}
test('hidden source artwork and editable mattes are tracked by fresh render receipts',async()=>{
  const receiptPath=path.join(base,'generated/head-render-receipt.json');
  await verifyPaintedRenderReceipt(root,receiptPath);
  const receipt=JSON.parse(await fs.readFile(receiptPath));
  const files=new Set(receipt.inputs.map(i=>i.file));
  for(const definition of Object.values(config.directions))for(const hidden of definition.hiddenSurfaces||[]){
    for(const file of [hidden.source,hidden.matte])assert.ok(files.has(path.relative(root,path.join(base,file))));
  }
  assert.equal(config.independentMotionAllowed,false,'A preservation test is not independent-layer visual approval');
  assert.equal(config.runtimeEligible,false);
});
