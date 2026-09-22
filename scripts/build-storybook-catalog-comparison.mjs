// Diagnostic contact sheets only; never modifies source rigs or runtime assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const staging=path.join(root,'character-assets/generated/storybook-runtime-staging-v1');
const manifest=JSON.parse(await fs.readFile(path.join(staging,'build-manifest.json')));
const out=path.join(root,'character-assets/rigs/storybook-expansion-v1/catalog-comparison-v1');
await fs.mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const rows=[];
for(const c of manifest.characters){
  const bytes=await fs.readFile(path.join(root,c.source));
  assert.equal(hash(bytes),c.sourceSheetSha256,'Stale staging source: '+c.characterId);
  const runtimeOutput=c.outputs.find(o=>o.file===`${c.presetId}__walk-runtime.png`);
  assert.ok(runtimeOutput,'Missing runtime output: '+c.characterId);
  const runtimePath=path.join(staging,c.presetId,runtimeOutput.file);
  assert.equal(hash(await fs.readFile(runtimePath)),runtimeOutput.sha256,'Stale runtime: '+c.characterId);
  const tiles=[];
  for(let d=0;d<4;d++){
    const frame=await sharp(bytes).extract({left:192,top:d*288,width:192,height:288}).png().toBuffer();
    tiles.push({input:await sharp(frame).resize(96,144).png().toBuffer(),left:88+d*100,top:18});
    tiles.push({input:await sharp(frame).resize(48,72).png().toBuffer(),left:520+d*52,top:52});
  }
  const label=Buffer.from(`<svg width="752" height="180"><rect width="752" height="180" fill="#e4e9dc"/><text x="8" y="30" font-family="sans-serif" font-size="16">${c.characterId}</text><text x="8" y="54" font-family="sans-serif" font-size="11">neutral 2</text></svg>`);
  rows.push({id:c.characterId,presetId:c.presetId,source:c.source,sha256:hash(bytes),runtime:path.relative(root,runtimePath),runtimeSha256:runtimeOutput.sha256,image:await sharp(label).composite(tiles).png().toBuffer()});
}
for(let page=0;page<3;page++){
  await sharp({create:{width:752,height:720,channels:4,background:'#e4e9dc'}}).composite(rows.slice(page*4,page*4+4).map((r,i)=>({input:r.image,left:0,top:i*180}))).png().toFile(path.join(out,`page-${page+1}.png`));
}
await fs.writeFile(path.join(out,'inputs.json'),JSON.stringify({scope:'diagnostic comparison only',directions:['front','left','right','back'],sizes:[[96,144],[48,72]],neutralFrame:2,characters:rows.map(({image,...r})=>r)},null,2)+'\n');
console.log('12 characters / 4 directions / 2 display sizes. Source hashes verified; no runtime changes.');
