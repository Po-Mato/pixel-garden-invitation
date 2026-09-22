import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {readPaintedHeadMaterial} from './lib/paintedHeadMaterial.mjs';
import {paintOriginalSourcePng} from './lib/paintedSourceOverlay.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const review=path.join(root,'character-assets/rigs/storybook-expansion-v1/review/contrast-v4');
const json=async f=>JSON.parse(await fs.readFile(f));
const hash=b=>createHash('sha256').update(b).digest('hex');
const changed=['guest-02','guest-05','guest-07'];
const allowed={
 'guest-02':['skirt-front','skirt-left','skirt-back','legLeft-left','legRight-left','legLeft-back','legRight-back','armLeft-left','armRight-left','torso-left'],
 'guest-05':['skirt-right','skirt-back','armLeft-back','armRight-back','legLeft-back','legRight-back'],
 'guest-07':['skirt-right','skirt-back','legLeft-right','legRight-right','legLeft-back','legRight-back']
};
for(const id of changed){
 const base=path.join(root,`character-assets/rigs/${id}/${id==='guest-05'?'storybook-directions-v1':'storybook-source-v1'}`);
 test(`${id}: only individually selected costume shading changes; no anatomy, source artwork or keyframe edits`,async()=>{
  const before=await json(path.join(review,`${id}-before-registration.json`)),after=await json(path.join(base,'body-registration.json'));
  const normalized=structuredClone(after);let n=0;
  for(const p of normalized.parts){const old=before.parts.find(o=>o.id===p.id);if(JSON.stringify(p.sourceOverlays)!==JSON.stringify(old.sourceOverlays)){
   assert.ok(allowed[id].includes(p.id));n++;
   assert.deepEqual(p.sourceOverlays.slice(0,(old.sourceOverlays||[]).length),old.sourceOverlays||[]);
   for(const f of p.sourceOverlays.slice((old.sourceOverlays||[]).length)){
    assert.match(f,/-v4\.svg$/);const b=await fs.readFile(path.resolve(base,f));assert.doesNotMatch(b.toString(),/<(?:image|foreignObject|script)\b|(?:href|xlink:href)\s*=/i);
   }
   if(old.sourceOverlays)p.sourceOverlays=old.sourceOverlays;else delete p.sourceOverlays;
  }}assert.equal(n,allowed[id].length);assert.deepEqual(normalized,before);
 });
 test(`${id}: complete sixteen-frame alpha and unpainted upper body are byte-identical`,async()=>{
  const before=await fs.readFile(path.join(review,`${id}-before-walk.png`));
  const after=await fs.readFile(path.join(base,'generated',id==='guest-05'?'guest05-walk-study.png':'walk-study.png'));
  assert.deepEqual(await sharp(after).extractChannel(3).raw().toBuffer(),await sharp(before).extractChannel(3).raw().toBuffer());
  for(let row=0;row<4;row++){
   const armStudy=(id==='guest-02'&&row===1)||(id==='guest-05'&&row===3);
   const hairStudy=(id==='guest-05'&&row>=2)||(id==='guest-02'&&row===1);
   const bottom=id==='guest-05'?162:170;
   const rect=armStudy?{left:0,top:row*288,width:768,height:60}:{left:0,top:row*288+(hairStudy?126:0),width:768,height:hairStudy?bottom-126:bottom};
   assert.deepEqual(await sharp(after).extract(rect).raw().toBuffer(),await sharp(before).extract(rect).raw().toBuffer());
  }
 });
 test(`${id}: every new material preserves opaque unpainted source RGB and cream interiors`,async()=>{
  const before=await json(path.join(review,`${id}-before-registration.json`)),after=await json(path.join(base,'body-registration.json'));
  for(const p of after.parts.filter(p=>allowed[id].includes(p.id))){
   const old=before.parts.find(o=>o.id===p.id),files=p.sourceOverlays.slice((old.sourceOverlays||[]).length);
   const source=id==='guest-05'?`sources/${p.source||p.id}-v1.png`:p.source,matte=id==='guest-05'?`masks/${p.source||p.id}-v1.svg`:p.matte;
   const {data:rgb,info}=await sharp(path.resolve(base,source)).removeAlpha().raw().toBuffer({resolveWithObject:true});
   const alpha=await sharp(path.resolve(base,matte)).ensureAlpha().extractChannel(3).raw().toBuffer();
   const rgba=Buffer.alloc(alpha.length*4);for(let i=0;i<alpha.length;i++)if(alpha[i]){rgb.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=alpha[i];}
   let prior=await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
   for(const f of old.sourceOverlays||[])prior=await paintOriginalSourcePng(prior,await fs.readFile(path.resolve(base,f)));
   const a=await sharp(prior).ensureAlpha().raw().toBuffer(),b=await sharp(path.join(base,'generated',p.id+'.png')).ensureAlpha().raw().toBuffer();
   const layers=await Promise.all(files.map(f=>sharp(path.resolve(base,f)).ensureAlpha().extractChannel(3).raw().toBuffer()));
   let preserved=0;for(let i=0;i<alpha.length;i++){assert.equal(b[i*4+3],alpha[i]);if(alpha[i]===255&&layers.every(l=>l[i]===0)){assert.ok(a.subarray(i*4,i*4+3).equals(b.subarray(i*4,i*4+3)),p.id+': unpainted RGB');preserved++;}}
   assert.ok(preserved>1000);
  }
 });
}
test('the other nine staged characters retain exact approved bytes',async()=>{
 const before=await json(path.join(review,'before-catalog.json'));
 const after=await json(path.join(root,'character-assets/generated/storybook-runtime-staging-v1/build-manifest.json'));
 for(const c of before.characters.filter(c=>!changed.includes(c.characterId))){const current=after.characters.find(a=>a.characterId===c.characterId);assert.equal(current.sourceSheetSha256,c.sourceSheetSha256);for(const o of c.outputs)assert.equal(hash(await fs.readFile(path.join(root,'character-assets/generated/storybook-runtime-staging-v1',c.presetId,o.file))),o.sha256);}
});
test('anchor hair shading changes only two explicit source materials, never faces or crowns',async()=>{
 const base=path.join(root,'character-assets/rigs/guest-05/storybook-directions-v1');
 const before=await json(path.join(review,'guest-05-before-head-layers.json')),after=await json(path.join(base,'head-layers.json')),normalized=structuredClone(after);
 for(const direction of ['right','back']){
  const def=after.directions[direction],files=def.sourceOverlays;assert.deepEqual(files,[`sources/head-${direction}-outer-lock-v4.svg`]);delete normalized.directions[direction].sourceOverlays;
  const source=`sources/head-${direction}-v1.png`,{data:original,info}=await readPaintedHeadMaterial(base,{source});
  const {data:painted}=await readPaintedHeadMaterial(base,{source,sourceOverlays:files});
  const alpha=await sharp(path.join(base,files[0])).ensureAlpha().extractChannel(3).raw().toBuffer();
  const face=def.layers.find(l=>l.id==='face');assert.ok(face?.path);
  const faceMask=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}"><path fill="white" d="${face.path}"/></svg>`)).ensureAlpha().extractChannel(3).raw().toBuffer();
  for(let i=0;i<alpha.length;i++){
   if(faceMask[i]||i<info.width*200)assert.equal(alpha[i],0,'Face and crown are protected');
   if(!alpha[i])assert.deepEqual(painted.subarray(i*3,i*3+3),original.subarray(i*3,i*3+3));
  }
 }
 assert.deepEqual(normalized,before);
});
