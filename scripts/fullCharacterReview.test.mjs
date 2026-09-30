import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from './lib/deterministicSharp.mjs';
import {sha256} from './lib/currentCharacterSources.mjs';
const root=path.resolve(import.meta.dirname,'..'),folder=path.join(root,'character-assets/generated/full-review-v1');
test('local package binds all twelve current sources and all outputs by hash',async()=>{
 const m=JSON.parse(await fs.readFile(path.join(folder,'build-manifest.json')));assert.equal(m.characters.length,12);assert.equal(m.localReviewOnly,true);assert.equal(m.productionReady,false);
 for(const c of m.characters){assert.equal(c.outputs.length,5);assert.equal(c.checks.length,16);for(const s of c.sources)assert.equal(sha256(await fs.readFile(path.join(root,s.file))),s.sha256);for(const o of c.outputs)assert.equal(sha256(await fs.readFile(path.join(folder,c.presetId,o.file))),o.sha256);}
});
test('A source-material repair changes only approved neck envelope in all four frames',async()=>{
 for(let f=1;f<=4;f++){const prefix='character-assets/rigs/hanbok-neck-art-',suffix=`/front-rig/guest-02/front-${f}.png`,a=await sharp(path.join(root,prefix+'v9'+suffix)).ensureAlpha().raw().toBuffer(),b=await sharp(path.join(root,prefix+'v10'+suffix)).ensureAlpha().raw().toBuffer();let changed=0;
 for(let y=0;y<288;y++)for(let x=0;x<192;x++){let p=(y*192+x)*4;if(!a.subarray(p,p+4).equals(b.subarray(p,p+4))){changed++;assert.ok(x>=81&&x<=108&&y>=126&&y<=146,`outside neck ${x},${y}`);assert.ok(a[p+3]>=240&&b[p+3]>=240,'no new transparent boundary');}}
 assert.ok(changed>0);}
});
test('latest hanbok source routing retains approved rear and independent profiles',async()=>{const m=JSON.parse(await fs.readFile(path.join(folder,'build-manifest.json')));for(const id of ['guest-02','guest-12']){const c=m.characters.find(c=>c.characterId===id);assert.equal(c.sources.length,16);for(const dir of ['left','right','back'])assert.equal(c.sources.filter(s=>s.file.includes('hanbok-directions-v8')&&s.file.endsWith(`${dir}-2.png`)).length,1);}assert.ok(m.characters.find(c=>c.characterId==='guest-02').sources.some(s=>s.file.includes('hanbok-neck-art-v10')));});
