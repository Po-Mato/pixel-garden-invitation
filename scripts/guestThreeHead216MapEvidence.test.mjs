import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {displayCalibrationProfiles} from './lib/mapToneAudit.mjs';
import {guest216MapInputs} from './lib/guest216MapInputs.mjs';
const root=new URL('../',import.meta.url),base=new URL('character-assets/rigs/common-three-head-216-v1/',root);
const hash=b=>createHash('sha256').update(b).digest('hex');
test('actual guest-12 runtime journey reaches all ten maps through game portals',async()=>{
 const report=JSON.parse(await readFile(new URL('runtime-map-journey.json',base)));
 const maps=JSON.parse(await readFile(new URL('map-assets/reference/v2/manifest.json',root))).zones.map(z=>z.id).sort();
 assert.equal(report.developmentOnly,true);assert.equal(report.productionIntegrated,false);assert.equal(report.complete,true);
 assert.equal(report.characterId,'guest-12');assert.deepEqual(report.viewport,[390,844]);
 assert.equal(report.sheetSha256,hash(await readFile(new URL('character-assets/generated/three-head-216-v1/masculine-blue-modern-hanbok/masculine-blue-modern-hanbok__walk-runtime.png',root))));
 assert.deepEqual(report.rows.map(r=>r.zone).sort(),maps);
 for(const r of report.rows){assert.deepEqual(r.size,[48,72]);assert.equal(r.sourceWidth,'96px');assert.ok(r.url.includes('guest-12-runtime.png'));assert.notEqual(r.filter,'none');assert.equal(r.sha256,hash(await readFile(new URL(r.file,base))));}
});
test('browser map fixture covers all current sheets, directions, frames and unchanged minimum thresholds',async()=>{
 const report=JSON.parse(await readFile(new URL('map-browser-evidence.json',base)));
 assert.equal(report.fixtureOnly,true);assert.equal(report.actualGame,false);
 assert.deepEqual(report.inputs,await guest216MapInputs(root),'Stale map, foreground, or measuring implementation');
 assert.equal(report.cssSha256,hash(await readFile(new URL('client/src/map-visual-enhancements.css',root))));
 assert.equal(report.thresholds.minCharacterEdgeContrast,1.17);assert.equal(report.thresholds.minDisplayCharacterEdgeContrast,1.1);
 assert.equal(report.sourceHashes.length,12);
 for(const c of report.sourceHashes)assert.equal(c.sha256,hash(await readFile(new URL(`character-assets/rigs/${c.id}/three-head-216-v1/review/walk-sheet.png`,root))));
 const zones=JSON.parse(await readFile(new URL('map-assets/reference/v2/manifest.json',root))).zones;
 const keys=new Set(report.rows.map(r=>[r.zone,r.id,r.direction,r.frame].join('/')));
 assert.equal(report.rows.length,1920);assert.equal(keys.size,1920);
 for(const z of zones)for(const c of report.sourceHashes)for(let d=0;d<4;d++)for(let f=0;f<4;f++)assert.ok(keys.has([z.id,c.id,d,f].join('/')));
 for(const r of report.rows){
  assert.ok(Number.isFinite(r.edgeContrast)&&Number(r.edgeContrast.toFixed(3))>=1.17,JSON.stringify(r));
  assert.deepEqual(Object.keys(r.displayEdgeContrasts).sort(),Object.keys(displayCalibrationProfiles).sort());
  for(const value of Object.values(r.displayEdgeContrasts))assert.ok(Number.isFinite(value)&&Number(value.toFixed(3))>=1.1,JSON.stringify(r));
 }
 assert.equal(report.captures.length,40);
 for(const capture of report.captures)assert.equal(capture.sha256,hash(await readFile(new URL(capture.file,base))));
 // This fixture deliberately does not approve the historical regression baseline or production release.
});
