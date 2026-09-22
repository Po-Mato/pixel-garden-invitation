import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-01/storybook-source-v1');
const out=path.join(base,'review/balanced-arms-four-direction-v2');
const audit=JSON.parse(await fs.readFile(path.join(out,'audit.json')));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('eight independent original arms match recorded source hashes and retain alpha',async()=>{
 assert.equal(audit.sourceAudit.length,8);assert.equal(new Set(audit.sourceAudit.map(a=>a.sha256)).size,8);
 for(const a of audit.sourceAudit){assert.equal(a.mirrored,false);assert.equal(a.alphaPreserved,true);const b=await fs.readFile(path.join(base,a.source));assert.equal(hash(b),a.sha256);assert.equal((await sharp(b).metadata()).hasAlpha,true);}
});
test('all sixteen frame sizes, hashes and neutral pairs are correct',async()=>{
 for(const d of audit.directions){const frames=[];for(let n=1;n<=4;n++){const b=await fs.readFile(path.join(out,`${d.direction}-walk-${n}.png`));const m=await sharp(b).metadata();assert.deepEqual([m.width,m.height],[192,288]);assert.equal(hash(b),d.frames[n-1]);frames.push(b);}assert.deepEqual(frames[1],frames[3]);assert.notDeepEqual(frames[0],frames[2]);}
});
test('previous front proposal remains unchanged',async()=>{
 for(let n=1;n<=4;n++)assert.deepEqual(await fs.readFile(path.join(out,`front-walk-${n}.png`)),await fs.readFile(path.join(base,`review/balanced-arms-v2/front-walk-${n}.png`)));
});
test('112 source-layer joint connections have nonempty connected alpha',()=>{
 assert.equal(audit.connections.length,112);for(const c of audit.connections){assert.ok(c.pixelsA>0&&c.pixelsB>0);assert.equal(c.connected,true);}
});
test('canonical source registration and neutral outputs are unchanged',async()=>{
 for(const [f,h] of audit.protectedHashes)assert.equal(hash(await fs.readFile(path.join(base,f))),h);
});
test('actual client selection used this candidate in four directions',async()=>{
 const e=JSON.parse(await fs.readFile(path.join(out,'client-selection-evidence.json'))),h=hash(await fs.readFile(path.join(out,'walk.png')));
 assert.equal(e.rows.length,4);for(const r of e.rows){assert.equal(r.sha256,h);assert.equal(new Set(r.frames).size,4);assert.equal(r.header,'guest01-balanced-candidate');assert.equal(r.serviceWorkerControlled,false);}
 assert.deepEqual(e.stop,{moving:false,frame:'1'});
});
test('actual game used this candidate at 48x72 with opposite movement signs',async()=>{
 const e=JSON.parse(await fs.readFile(path.join(out,'client-game-evidence.json'))),h=hash(await fs.readFile(path.join(out,'walk-runtime.png')));
 assert.equal(e.rows.length,4);for(const r of e.rows){assert.equal(r.sha256,h);assert.equal(new Set(r.frames).size,4);assert.deepEqual(r.moving.size,['48px','72px']);assert.ok(['left','up'].includes(r.direction)?r.delta<0:r.delta>0);assert.equal(r.stopped.moving,'false');}
});
test('map release gate is tied to current candidate and unchanged thresholds',async()=>{
 const e=JSON.parse(await fs.readFile(path.join(out,'map-evidence.json'))),g=JSON.parse(await fs.readFile(path.join(out,'release-gate.json'))),contract=JSON.parse(await fs.readFile(path.join(root,'scripts/visual-baselines/map-tone-contract.json')));
 assert.deepEqual(e.thresholds,contract.thresholds);assert.deepEqual(g.thresholds,contract.thresholds);
 assert.equal(e.sourceHashes.find(s=>s.id==='guest01-approved').sha256,hash(await fs.readFile(path.join(out,'walk-runtime.png'))));
 assert.equal(e.rows.filter(r=>r.id==='guest01-approved').length,160);
 const failed=e.belowStandardThreshold.some(r=>r.id==='guest01-approved')||e.belowDisplayThreshold.some(r=>r.id==='guest01-approved');
 assert.equal(g.releaseEligible,!failed);assert.equal(g.shapeApprovedByUser,true);
});
test('neighborhood live movement covers all four directions without asset substitution',async()=>{
 const e=JSON.parse(await fs.readFile(path.join(out,'client-game-neighborhood-evidence.json'))),h=hash(await fs.readFile(path.join(out,'walk-runtime.png')));
 assert.equal(e.rows.length,4);assert.equal(new Set(e.rows.map(r=>r.direction)).size,4);
 for(const r of e.rows){assert.equal(r.sha256,h);assert.equal(new Set(r.frames).size,4);assert.deepEqual(r.moving.size,['48px','72px']);assert.equal(r.stopped.moving,'false');assert.ok(['left','up'].includes(r.direction)?r.delta<0:r.delta>0);}
});
