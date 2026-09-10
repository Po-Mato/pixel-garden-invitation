import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {measureCompositedMapTone,measureMapTone,evaluateMapToneMetrics,characterEdgeShadowsFromCss} from './lib/mapToneAudit.mjs';
const root=new URL('../',import.meta.url),rootDir=fileURLToPath(root);
const json=async p=>JSON.parse(await readFile(new URL(p,root)));
const contract=await json('scripts/visual-baselines/map-tone-contract.json'),maps=await json('map-assets/reference/v2/manifest.json'),catalog=await json('character-assets/rigs/guest-cutout-catalog-v1.json');
const edgeShadows=characterEdgeShadowsFromCss(await readFile(new URL('client/src/map-visual-enhancements.css',root),'utf8'),Object.keys(contract.zones));
const characters=[],sourceHashes=[];
for(const c of catalog.characters){
 const base=new URL(`character-assets/rigs/${c.characterId}/three-head-216-v1/`,root),movementFrames=[];
 for(const[d,row]of [['front','down'],['left','left'],['right','right'],['back','up']])for(let i=1;i<=4;i++){
  const bytes=await readFile(new URL(`generated/${d}/frame-${i}.png`,base));sourceHashes.push({id:c.characterId,direction:d,frame:i,sha256:createHash('sha256').update(bytes).digest('hex')});
  movementFrames.push({frameId:row+'-'+(i-1),buffer:await sharp(bytes).resize(48,72,{kernel:'nearest'}).png().toBuffer()});
 }
 characters.push({presetId:c.presetId,width:48,height:72,buffer:movementFrames[1].buffer,movementFrames});
}
const onlyFront=record=>Object.fromEntries(Object.entries(record).map(([id,frames])=>[id,Object.fromEntries(Object.entries(frames).filter(([frame])=>frame.startsWith('down-')))]));
const reports=[],issues=[];
for(const zone of maps.zones){
 const background=await measureMapTone(fileURLToPath(new URL(`client/public/assets/maps/v2/${zone.id}/${zone.background.output}`,root)));
 const {sceneBuffer,...tone}=await measureCompositedMapTone({rootDir,zone,characters,defaultPresetId:catalog.characters[0].presetId,edgeShadow:edgeShadows[zone.id]});
 // Compare the historically baselined front four frames without changing its thresholds or baseline.
 const front={...background,...tone,movementFrameCount:4,characterMovementEdgeContrasts:onlyFront(tone.characterMovementEdgeContrasts),displayProfiles:Object.fromEntries(Object.entries(tone.displayProfiles).map(([k,p])=>[k,{...p,characterMovementEdgeContrasts:onlyFront(p.characterMovementEdgeContrasts)}]))};
 const evaluation=evaluateMapToneMetrics(front,contract.zones[zone.id],contract.thresholds);
 for(const[id,frames]of Object.entries(tone.characterMovementEdgeContrasts))for(const[f,value]of Object.entries(frames))if(value<contract.thresholds.minCharacterEdgeContrast)evaluation.issues.push(`${id}/${f}: all-direction edge contrast ${value}`);
 for(const[profile,p]of Object.entries(tone.displayProfiles))for(const[id,frames]of Object.entries(p.characterMovementEdgeContrasts))for(const[f,value]of Object.entries(frames))if(value<contract.thresholds.minDisplayCharacterEdgeContrast)evaluation.issues.push(`${profile}/${id}/${f}: all-direction display contrast ${value}`);
 reports.push({zoneId:zone.id,...background,...tone,issues:evaluation.issues});issues.push(...evaluation.issues.map(x=>zone.id+': '+x));
 console.log(zone.id+': '+evaluation.issues.length+' issues, weakest edge '+tone.weakestMovementEdgeContrast.toFixed(3));
}
for(const source of sourceHashes){
 const bytes=await readFile(new URL(`character-assets/rigs/${source.id}/three-head-216-v1/generated/${source.direction}/frame-${source.frame}.png`,root));
 if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error('Source changed during map audit; rerun after rendering: '+source.id);
}
await writeFile(new URL('character-assets/rigs/common-three-head-216-v1/map-tone-review.json',root),JSON.stringify({developmentOnly:true,methodology:'Historical one-shadow map regression model; not the full runtime CSS filter chain. See separate browser fixture evidence.',thresholds:contract.thresholds,baselineVersion:contract.version,sourceHashes,reports,issues,passed:issues.length===0},null,2)+'\n');
process.exitCode=issues.length?1:0;
