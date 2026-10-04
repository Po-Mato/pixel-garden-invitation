import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from './lib/deterministicSharp.mjs';
import {DEFAULT_FOREGROUND_PLACEMENTS} from './lib/mapForegroundAuditRenderer.mjs';
import {mapToneCharacterPositions} from './lib/mapToneAudit.mjs';
import {createHash} from 'node:crypto';
const sha256=b=>createHash('sha256').update(b).digest('hex');
import {verifyCoupleStyleProductionSources} from './lib/coupleStyleProductionSources.mjs';
import {assertCoupleStyleWorldCss,characterSceneLayer,measureSceneEdge,renderCoupleStyleWorldFrame} from './lib/coupleStyleMapComposite.mjs';
const root=path.resolve(import.meta.dirname,'..');
await verifyCoupleStyleProductionSources(root);
const packageDirectory='character-assets/generated/couple-style-v1';
const out=path.join(root,'character-assets/rigs/couple-style-release-v1/map-review');await fs.mkdir(out,{recursive:true});
const inputs={},read=async file=>{const b=await fs.readFile(path.join(root,file));inputs[file]=sha256(b);return b;},json=async f=>JSON.parse(await read(f));
for(const f of ['scripts/audit-couple-style-map-composites.mjs','scripts/lib/coupleStyleMapComposite.mjs','scripts/lib/mapToneAudit.mjs','scripts/lib/mapForegroundAuditRenderer.mjs'])await read(f);
const manifest=await json(`${packageDirectory}/build-manifest.json`),maps=await json('map-assets/reference/v2/manifest.json'),contract=await json('scripts/visual-baselines/map-tone-contract.json');
const css=(await read('client/src/map-visual-enhancements.css')).toString(),characters=[];
assertCoupleStyleWorldCss((await read('client/src/styles.css')).toString());
const style={};
assert.ok(css.includes('drop-shadow(-1px -1px 0 var(--character-outline-shadow, rgba(0, 0, 0, 0)))'));
assert.ok(css.includes('drop-shadow(0 1px 0 var(--character-edge-shadow))'));
assert.ok(css.includes('drop-shadow(1px 2px 0 var(--character-secondary-edge-shadow, var(--character-edge-shadow)))'));
for(const c of manifest.characters){

 const sheet=await read(`${packageDirectory}/${c.presetId}__walk.png`),frames=[];
 const declared=c.outputs.find(o=>o.file===`${c.presetId}__walk.png`);assert.ok(declared);assert.equal(sha256(sheet),declared.sha256,`Runtime hash mismatch: ${c.characterId}`);
 for(let d=0;d<4;d++)for(let f=0;f<4;f++){
  const png=await renderCoupleStyleWorldFrame(await sharp(sheet).extract({left:f*96,top:d*144,width:96,height:144}).png().toBuffer());
  frames.push({direction:d,frame:f,png,raw:await sharp(png).ensureAlpha().raw().toBuffer()});
 }characters.push({id:c.characterId,frames});
}
const rows=[],outputs={};
for(const zone of maps.zones){
 const block=css.match(new RegExp(`\\.world-map__stage\\[data-zone="${zone.id}"\\]\\s*\\{([^}]+)`))?.[1],tone=block?.match(/--character-tone-filter:\s*([^;]+)/)?.[1],shadow=block?.match(/--character-edge-shadow:\s*([^;]+)/)?.[1];assert.ok(tone&&shadow);
 const secondary=block.match(/--character-secondary-edge-shadow:\s*([^;]+)/)?.[1]??shadow,outline=block.match(/--character-outline-shadow:\s*([^;]+)/)?.[1];
 const scene=await sharp(await read(`client/public/assets/maps/v2/${zone.id}/${zone.background.output}`)).composite(await Promise.all((DEFAULT_FOREGROUND_PLACEMENTS[zone.id]||[]).map(async p=>({input:await read(`client/public/assets/maps/v2/${zone.id}/${p.asset}`),left:p.x,top:p.y})))).png().toBuffer();
 const p=mapToneCharacterPositions[zone.id],background=await sharp(scene).extract({left:p.x-42,top:p.y-52,width:84,height:104}).png().toBuffer(),tiles=[];
 for(const [index,c]of characters.entries())for(const f of c.frames){
  const activeShadow=style[zone.id]?.shadow??shadow;
  const composite=await sharp(background).composite([{input:await characterSceneLayer(f.png,tone,activeShadow,style[zone.id]?.secondaryShadow??secondary,outline),left:0,top:0}]).png().toBuffer();
  const raw=await sharp(composite).ensureAlpha().raw().toBuffer(),{standard,...display}=measureSceneEdge(raw,f.raw);
  rows.push({zone:zone.id,id:c.id,direction:f.direction,frame:f.frame,edgeContrast:standard,displayEdgeContrasts:display});
  if(f.frame===1)tiles.push({input:composite,left:index*84,top:f.direction*104});
 }
 const file=`${zone.id}.png`,png=await sharp({create:{width:1008,height:416,channels:4,background:'#e8e6dc'}}).composite(tiles).png().toBuffer();await fs.writeFile(path.join(out,file),png);outputs[file]=sha256(png);
 console.log(zone.id+' composites complete');
}
const thresholds=contract.thresholds,standard=rows.filter(r=>Number(r.edgeContrast.toFixed(3))<thresholds.minCharacterEdgeContrast),display=rows.filter(r=>Object.values(r.displayEdgeContrasts).some(v=>Number(v.toFixed(3))<thresholds.minDisplayCharacterEdgeContrast));
const report={model:'offline-srgb-couple-style-world-7over6-v1',styleCandidateOnly:false,fixtureOnly:true,actualGame:false,browserVerified:false,mobileVerified:false,thresholds,inputs,outputs,rows,belowStandardThreshold:standard,belowDisplayThreshold:display};
await fs.writeFile(path.join(out,'audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({samples:rows.length,standardFailures:standard.length,displayFailures:display.length}));
assert.equal(rows.length,1920);
assert.equal(standard.length,0,'Source art requires map contrast review');assert.equal(display.length,0,'Source art requires display contrast review');
