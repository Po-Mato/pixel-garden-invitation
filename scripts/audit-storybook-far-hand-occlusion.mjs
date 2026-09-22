import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id=process.argv[2];assert.match(id||'',/^guest-\d{2}$/);
const base=path.join(root,'character-assets/rigs',id,'storybook-source-v1');
const out=path.join(base,'generated');
await verifyPaintedRenderReceipt(root,path.join(out,'walk-render-receipt.json'));
const rig=JSON.parse(await fs.readFile(path.join(base,'body-registration.json')));
const rows=[];
for(const direction of ['left','right']){
  const far=rig.parts.filter(p=>p.direction===direction&&p.layer==='farArm');
  assert.equal(far.length,1);
  const joint=far[0].parent.replace('upperArm','hand');
  const material=await fs.readFile(path.join(out,`${direction}-${joint}-source.svg`));
  const image=`<image width="192" height="288" href="data:image/svg+xml;base64,${material.toString('base64')}"/>`;
  for(let frame=1;frame<=4;frame++){
    const svg=await fs.readFile(path.join(out,`${direction}-walk-${frame}.svg`),'utf8');
    assert.equal(svg.split(image).length,2,'Diagnostic must identify exactly one far-hand source instance');
    // Counterfactual source-layer render in memory only. Never edits a final PNG.
    const hidden=svg.replace(image,'');
    const original=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
    assert.deepEqual(original,await sharp(path.join(out,`${direction}-walk-${frame}.png`)).ensureAlpha().raw().toBuffer(),'Diagnostic source must reproduce the current frame exactly');
    const without=await sharp(Buffer.from(hidden)).ensureAlpha().raw().toBuffer();
    let changed=0,minX=192,minY=288,maxX=-1,maxY=-1;
    for(let i=0;i<192*288;i++)if([0,1,2,3].some(c=>original[i*4+c]!==without[i*4+c])){
      changed++;const x=i%192,y=Math.floor(i/192);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    rows.push({direction,frame,part:far[0].id,joint,visibleContributionPixels:changed,bounds:changed?[minX,minY,maxX,maxY]:null,frameSourceSha256:createHash('sha256').update(svg).digest('hex')});
  }
}
const report={character:id,scope:'fixed shared walk only; does not approve hidden anatomy or future poses',visualApproved:false,allProfileFarHandsFullyOccluded:rows.every(r=>r.visibleContributionPixels===0),rows};
await fs.writeFile(path.join(out,'far-hand-occlusion-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
