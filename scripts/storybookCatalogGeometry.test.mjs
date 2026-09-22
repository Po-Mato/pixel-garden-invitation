import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=async file=>JSON.parse(await fs.readFile(path.join(root,file)));
const catalog=await readJson('character-assets/rigs/guest-cutout-catalog-v1.json');
const staging=await readJson('character-assets/generated/storybook-runtime-staging-v1/build-manifest.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(catalog.characters.length,12);
assert.equal(new Set(catalog.characters.map(c=>c.characterId)).size,12);

for(const {characterId,presetId} of catalog.characters){
  test(`${characterId}: all 16 frames retain geometry, fixed head and subpixel horizontal stability`,async()=>{
    const entry=staging.characters.find(c=>c.characterId===characterId);
    assert.ok(entry);assert.equal(entry.presetId,presetId);
    const source=path.join(root,entry.source),bytes=await fs.readFile(source);
    assert.equal(hash(bytes),entry.sourceSheetSha256,'Geometry must inspect the current staged source');
    assert.equal(entry.sourceReceiptVerified,true);
    await verifyPaintedRenderReceipt(root,path.join(path.dirname(source),'walk-render-receipt.json'));
    const meta=await sharp(bytes).metadata();
    assert.equal(meta.width,768);assert.equal(meta.height,1152);assert.equal(meta.channels,4);
    for(const [row,direction] of ['front','left','right','back'].entries()){
      const frames=[];const centers=[];
      for(let column=0;column<4;column++){
        const frame=await sharp(bytes).extract({left:column*192,top:row*288,width:192,height:288}).raw().toBuffer();
        frames.push(frame);let alpha=0,weightedX=0,top=288,sole=-1;
        for(let y=0;y<288;y++)for(let x=0;x<192;x++){
          const a=frame[(y*192+x)*4+3];
          // Anatomical crown-to-ground window: excludes the root shadow below the feet.
          if(y>=54&&y<270){alpha+=a;weightedX+=x*a;}
          if(a>=128){top=Math.min(top,y);if(y>=235&&x>=40&&x<150)sole=Math.max(sole,y);}
        }
        assert.ok(alpha>0);centers.push(weightedX/alpha);
        assert.equal(top,54,`${direction}/${column}: crown plane`);
        assert.equal(sole,269,`${direction}/${column}: common ground plane at 270`);
        for(let y=124;y<=140;y++)assert.ok(frame[(y*192+96)*4+3]>=128,`${direction}/${column}: central neck connection`);
      }
      assert.deepEqual(frames[1],frames[3],`${direction}: neutral frames must be identical`);
      assert.notDeepEqual(frames[0],frames[2],`${direction}: opposite strides must differ`);
      for(const frame of frames)assert.deepEqual(frame.subarray(54*192*4,126*192*4),frames[1].subarray(54*192*4,126*192*4),`${direction}: head cannot stretch between frames`);
      const displacement=(Math.max(...centers)-Math.min(...centers))/4;
      assert.ok(displacement<=1,`${direction}: horizontal centroid moves ${displacement}px at 48x72, limit 1px`);
    }
  });
}

test('geometry checks never substitute for visual approval or map contrast acceptance',()=>{
  assert.equal(staging.stagingOnly,true);
  assert.equal(staging.runtimeEligible,false);
  assert.equal(staging.visualApproved,false);
  assert.equal(staging.publicAssetsModified,false);
});
