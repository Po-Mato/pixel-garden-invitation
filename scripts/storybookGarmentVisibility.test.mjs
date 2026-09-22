import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';
const root=new URL('../',import.meta.url);
const base=new URL('character-assets/rigs/guest-06/storybook-source-v1/',root);
test('long-skirt visibility is an editable costume layer with intact ankles and shoes',async()=>{
  const rig=JSON.parse(await fs.readFile(new URL('body-registration.json',base)));
  assert.equal(rig.legVisibility.parent,'pelvis');
  const source=await fs.readFile(new URL(rig.legVisibility.source,base),'utf8');
  assert.ok(!/<image|href=|<script/.test(source));
  const {data,info}=await sharp(Buffer.from(source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,192);assert.equal(info.height,288);
  for(let y=0;y<288;y++)for(let x=0;x<192;x++)assert.equal(data[(y*192+x)*4+3],y<248?0:255);
});
test('costume visibility hides covered leg protrusions, never changes feet or upper body pixels',async()=>{
  await verifyPaintedRenderReceipt(fileURLToPath(root),fileURLToPath(new URL('generated/walk-render-receipt.json',base)));
  let changed=0;
  for(const direction of ['front','left','right','back'])for(let frame=1;frame<=4;frame++){
    const svg=await fs.readFile(new URL(`generated/${direction}-walk-${frame}.svg`,base),'utf8');
    assert.equal((svg.match(/mask="url\(#costume-leg-visibility\)"/g)||[]).length,6);
    const raw=async s=>sharp(Buffer.from(s)).ensureAlpha().raw().toBuffer();
    const normal=await raw(svg);
    // Diagnostic source render only: no frame is patched or persisted here.
    const exposed=await raw(svg.replaceAll(' mask="url(#costume-leg-visibility)"',''));
    for(let y=0;y<288;y++){
      const a=normal.subarray(y*192*4,(y+1)*192*4),b=exposed.subarray(y*192*4,(y+1)*192*4);
      // Costume starts at waistband y=171, not the neutral thigh pivot:
      // rotation can project a thigh source above that pivot inside the skirt.
      if(y<171||y>=248)assert.deepEqual(a,b,`${direction} ${frame}: anatomy outside garment must stay unchanged`);
      else if(!a.equals(b))changed++;
    }
  }
  assert.ok(changed>0,'The reviewed skirt must actually hide covered leg protrusions');
});
