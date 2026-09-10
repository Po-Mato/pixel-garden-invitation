import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {auditGuest216MapRegression} from './audit-guest216-map-regression.mjs';
const root=new URL('../',import.meta.url);
const json=async p=>JSON.parse(await readFile(new URL(p,root)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const skeleton=await json('character-assets/rigs/common-three-head-216-v1/skeleton.json');
const catalog=await json('character-assets/rigs/guest-cutout-catalog-v1.json');
let selection,staging,mapAudit;
for(const [kind,path]of [['selection','character-assets/rigs/common-three-head-216-v1/local-selection-review.json'],['staging','character-assets/generated/three-head-216-v1/build-manifest.json'],['map','character-assets/rigs/common-three-head-216-v1/map-tone-review.json']]){
 try{const value=await json(path);if(kind==='selection')selection=value;else if(kind==='staging')staging=value;else mapAudit=value;}catch(error){if(error.code!=='ENOENT')throw error;}
}
const characters=[],blockers=[];
if(skeleton.geometry.headHeight!==72||skeleton.geometry.bodyHeight!==144||skeleton.geometry.characterHeight!==216)blockers.push({id:'skeleton-geometry-invalid'});
for(const entry of catalog.characters){
 const base='character-assets/rigs/'+entry.characterId+'/three-head-216-v1/';
 const directions=[];
 for(const direction of ['front','left','right','back']){
  try{
   const rig=await json(base+direction+'-rig.json');
   const m=await json(base+'generated/'+direction+'/manifest.json');
   let integrity=true;
   for(const frame of m.frames){
    const b=await readFile(new URL(base+'generated/'+direction+'/frame-'+frame.frame+'.png',root)),meta=await sharp(b).metadata();
    integrity&&=hash(b)===frame.sha256&&meta.width===192&&meta.height===288;
   }
   for(const source of m.sources)integrity&&=hash(await readFile(new URL(source.file,new URL(base,root))))===source.sha256;
   directions.push({direction,originalRig:rig.id,integrity,headHeight:m.headOpaqueBounds?.height,totalHeights:m.frames.map(f=>f.silhouette.height),runtimeEnabled:rig.runtimeEnabled});
  }catch(error){if(error.code!=='ENOENT')throw error;directions.push({direction,missing:true});}
 }
 const complete=directions.every(d=>!d.missing&&d.integrity&&d.headHeight===72&&d.totalHeights.every(h=>h===216));
 let browserEvidence=false;
 try{const e=await json(base+'review/browser-review.json'),m=await json(base+'review/manifest.json');browserEvidence=e.sheetSha256===m.sheetSha256&&m.sheetSha256===hash(await readFile(new URL(base+'review/walk-sheet.png',root)));}catch(error){if(error.code!=='ENOENT')throw error;}
 let selectionEvidence=false,gameEvidence=false,stagingEvidence=false,stagedRuntimeEvidence=false;
 try{
  const sheet=hash(await readFile(new URL(base+'review/walk-sheet.png',root)));
  const selected=selection?.guests?.find(c=>c.id===entry.characterId);
  selectionEvidence=selected?.response?.sha256===sheet&&selected?.response?.header===sheet&&selected?.response?.cache==='no-store';
  const game=await json(base+'review/local-game-216-review.json');gameEvidence=game.sheetSha256===sheet&&game.rows.length===4;
  for(const screen of game.screenshots)gameEvidence&&=screen.sha256===hash(await readFile(new URL(base+'review/'+screen.file,root)));
  const exported=staging?.characters.find(c=>c.characterId===entry.characterId);stagingEvidence=exported?.sourceSheetSha256===sheet;
  const runtime=await json(base+'review/local-game-216-runtime-review.json');
  stagedRuntimeEvidence=runtime.stagedRuntime===true&&runtime.sourceSheetSha256===sheet&&runtime.sheetSha256===exported?.outputs.find(o=>o.file.endsWith('__walk-runtime.png'))?.sha256&&runtime.rows.length===4;
  for(const screen of runtime.screenshots)stagedRuntimeEvidence&&=screen.sha256===hash(await readFile(new URL(base+'review/'+screen.file,root)));
 }catch(error){if(error.code!=='ENOENT')throw error;}
 characters.push({id:entry.characterId,label:entry.label,family:entry.template,directions,geometryComplete:complete,browserEvidence,selectionEvidence,gameEvidence,stagingEvidence,stagedRuntimeEvidence});
 if(!complete)blockers.push({id:'source-or-render-incomplete',characterId:entry.characterId});
 if(!browserEvidence)blockers.push({id:'current-mobile-evidence-missing',characterId:entry.characterId});
 if(!selectionEvidence)blockers.push({id:'current-selection-evidence-missing',characterId:entry.characterId});
 if(!gameEvidence)blockers.push({id:'current-game-evidence-missing',characterId:entry.characterId});
 if(!stagingEvidence)blockers.push({id:'current-staging-export-missing',characterId:entry.characterId});
 if(!stagedRuntimeEvidence)blockers.push({id:'current-staged-runtime-browser-evidence-missing',characterId:entry.characterId});
}
let currentMapAudit=Boolean(mapAudit?.sourceHashes?.length===192);
for(const source of mapAudit?.sourceHashes||[])currentMapAudit&&=source.sha256===hash(await readFile(new URL(`character-assets/rigs/${source.id}/three-head-216-v1/generated/${source.direction}/frame-${source.frame}.png`,root)));
let currentMapRegression;
try { currentMapRegression=await auditGuest216MapRegression(); }
catch(error) { currentMapRegression={passed:false,issues:[error.message]}; }
if(!currentMapRegression.passed)blockers.push({id:'current-browser-map-regression-not-passed',issues:currentMapRegression.issues});
let normalRuntimeAssets=true;
for(const entry of catalog.characters)for(const kind of ['walk','idle'])for(const [suffix,folder]of [['hd','guests/preview'],['runtime','guests']]){
 try{normalRuntimeAssets&&=hash(await readFile(new URL(`character-assets/generated/three-head-216-v1/${entry.presetId}/${entry.presetId}__${kind}-${suffix}.png`,root)))===hash(await readFile(new URL(`client/public/characters/generated/${folder}/${entry.presetId}__${kind}.png`,root)));}catch(error){if(error.code!=='ENOENT')throw error;normalRuntimeAssets=false;}
}
if(!normalRuntimeAssets)blockers.push({id:'normal-runtime-assets-not-current'});
blockers.push({id:'release-gates-and-remote-production-verification-pending',message:'Local asset integration is not a production deployment. Full release gates, reviewed visual baseline migration, commit/PR/deployment and remote SW/hash validation remain required.'});
console.log(JSON.stringify({scope:'read-only-readiness-report-not-a-release-gate-in-CI',project:fileURLToPath(root),readyForRelease:false,geometry:skeleton.geometry,geometryDecisionRequired:false,characters,normalRuntimeAssets,currentMapRegression,historicalSingleShadowAudit:{current:currentMapAudit,passed:mapAudit?.passed??false,issueCount:mapAudit?.issues?.length??null,preserved:true},blockers,untouched:['source artwork','generated PNGs','public runtime assets','git history','deployment']},null,2));
process.exitCode=1;
