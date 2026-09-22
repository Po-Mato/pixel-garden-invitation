import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {inspectStorybookJointConnections} from './lib/storybookJointConnections.mjs';
import {verifyPaintedRenderReceipt} from './lib/paintedRenderReceipt.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(await fs.readFile(path.join(root,'character-assets/rigs/guest-cutout-catalog-v1.json')));
const selected=process.argv.slice(2);
const guests=catalog.characters.map(c=>c.characterId).filter(id=>!selected.length||selected.includes(id));
if(!guests.length||selected.some(id=>!guests.includes(id)))throw Error('Choose character IDs from the current catalog.');
const report={scope:selected.length?'selected-source-rigs':'complete-twelve-character-catalog',characters:[],renderReceipts:[],activeSourceOverrides:[],rigidHeadDirections:0,frames:0,connections:0,connected:0,concealed:[],unobserved:[],disconnected:[],visualApproved:false,
  limitation:'Actual frame source layers, transforms and masks are retained, including the separate guest-05 anchor renderer. Connectivity does not prove natural anatomy, ownership, pleasing seams or visible occlusion.'};
for(const id of guests){
  const base=path.join(root,'character-assets/rigs',id,id==='guest-05'?'storybook-directions-v1':'storybook-source-v1');
  const receiptFile=path.join(base,'generated/walk-render-receipt.json');
  await verifyPaintedRenderReceipt(root,receiptFile);
  const receiptHash=createHash('sha256').update(await fs.readFile(receiptFile)).digest('hex');
  report.characters.push(id);
  const referenceHeads=new Map();
  for(const direction of ['front','left','right','back'])for(let frame=1;frame<=4;frame++){
    const {connections,headLayers}=await inspectStorybookJointConnections(base,direction,frame);
    if(frame===1)referenceHeads.set(direction,headLayers);
    else assert.deepEqual(headLayers,referenceHeads.get(direction),`${id}/${direction}: complete head source or transform changes during walking`);
    if(frame===4)report.rigidHeadDirections++;
    report.frames++;
    for(const pair of connections){
      report.connections++;
      if(pair.status==='connected')report.connected++;
      else if(pair.status==='connected-under-garment')report.concealed.push({id,direction,frame,...pair});
      else report[pair.status==='disconnected'?'disconnected':'unobserved'].push({id,direction,frame,...pair});
    }
  }
  await verifyPaintedRenderReceipt(root,receiptFile);
  if(createHash('sha256').update(await fs.readFile(receiptFile)).digest('hex')!==receiptHash)throw Error(`${id}: source render changed during joint inspection`);
  report.renderReceipts.push({id,file:path.relative(root,receiptFile),sha256:receiptHash});
  if(id==='guest-01'){
    // The balanced recipe is additive: the base-source audit above still covers
    // the unchanged concealed leg geometry, but cannot prove the active sleeves.
    const active=JSON.parse(await fs.readFile(path.join(base,'active-source-recipe.json')));
    assert.equal(active.renderer,'guest01-balanced-source-v3');
    assert.equal(active.generatedDirectory,'generated/balanced-v3');
    const directory=path.join(base,active.generatedDirectory);
    const activeReceipt=path.join(directory,'source-render-receipt.json');
    await verifyPaintedRenderReceipt(root,activeReceipt);
    const audit=JSON.parse(await fs.readFile(path.join(directory,'audit.json')));
    assert.equal(audit.connections.length,112);
    for(const direction of ['front','left','right','back']){
      let head;
      for(let frame=1;frame<=4;frame++){
        const pairs=audit.connections.filter(c=>c.direction===direction&&c.frame===frame);
        assert.equal(pairs.length,7);
        assert.ok(pairs.every(c=>c.connected&&c.pixelsA>0&&c.pixelsB>0));
        const pixels=await sharp(path.join(directory,`${direction}-walk-${frame}.png`)).extract({left:0,top:54,width:192,height:72}).raw().toBuffer();
        if(head)assert.deepEqual(pixels,head,'Active balanced head must remain rigid');
        else head=pixels;
      }
    }
    await verifyPaintedRenderReceipt(root,activeReceipt);
    report.activeSourceOverrides.push({id,renderer:active.renderer,frames:16,rigidHeadDirections:4,connections:112,disconnected:0,receipt:path.relative(root,activeReceipt),receiptSha256:createHash('sha256').update(await fs.readFile(activeReceipt)).digest('hex'),scope:'Active neck and arm connections; unchanged concealed leg geometry is audited through the base recipe above.'});
  }
  process.stderr.write(`${id}: source joint inspection finished\n`);
}
console.log(JSON.stringify(report,null,2));
if(!selected.length)await fs.writeFile(path.join(root,'character-assets/rigs/storybook-expansion-v1/joint-connection-evidence.json'),JSON.stringify(report,null,2)+'\n');
if(report.disconnected.length||report.unobserved.length)process.exitCode=1;
