import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const output=new URL('character-assets/generated/three-head-216-v1/',root);
const catalog=JSON.parse(await readFile(new URL('character-assets/rigs/guest-cutout-catalog-v1.json',root)));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function packed(w,h,images){
 const pixels=Buffer.alloc(w*h*4);
 for(const {input,left,top}of images){
  const {data,info}=await sharp(input).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.channels,4);assert.ok(left>=0&&top>=0&&left+info.width<=w&&top+info.height<=h);
  // Exact rectangular atlas packing of complete frames, not body-region correction.
  for(let y=0;y<info.height;y++)data.copy(pixels,((top+y)*w+left)*4,y*info.width*4,(y+1)*info.width*4);
 }
 return sharp(pixels,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
}
const characters=[];
// Staging adapter only. It neither modifies public assets nor changes the active generator.
for(const character of catalog.characters){
 const base=new URL(`character-assets/rigs/${character.characterId}/three-head-216-v1/`,root);
 const manifest=JSON.parse(await readFile(new URL('review/manifest.json',base)));
 const high=await readFile(new URL('review/walk-sheet.png',base));assert.equal(hash(high),manifest.sheetSha256);
 const resized=[],neutral=await readFile(new URL('generated/front/frame-2.png',base));
 for(const[row,direction]of ['front','left','right','back'].entries())for(let frame=1;frame<=4;frame++){
  const bytes=await readFile(new URL(`generated/${direction}/frame-${frame}.png`,base));
  assert.equal(hash(bytes),manifest.sources.find(s=>s.direction===direction&&s.frame===frame).sha256);
  // Whole-frame reduction only: no facial, shoulder, clothing or foot pixel operation.
  resized.push({input:await sharp(bytes).resize(96,144,{kernel:'nearest'}).png().toBuffer(),left:(frame-1)*96,top:row*144});
 }
 const runtime=await packed(384,576,resized),neutralRuntime=resized[1].input;
 const hdIdle=await packed(384,288,[{input:neutral,left:0,top:0},{input:neutral,left:192,top:0}]);
 const rtIdle=await packed(192,144,[{input:neutralRuntime,left:0,top:0},{input:neutralRuntime,left:96,top:0}]);
 const files={[`${character.presetId}__walk-hd.png`]:high,[`${character.presetId}__idle-hd.png`]:hdIdle,[`${character.presetId}__walk-runtime.png`]:runtime,[`${character.presetId}__idle-runtime.png`]:rtIdle};
 const directory=new URL(character.presetId+'/',output);await mkdir(directory,{recursive:true});
 const outputs=[];for(const[file,bytes]of Object.entries(files)){await writeFile(new URL(file,directory),bytes);outputs.push({file,sha256:hash(bytes)});}
 characters.push({characterId:character.characterId,presetId:character.presetId,sourceSheetSha256:manifest.sheetSha256,outputs});
}
await writeFile(new URL('build-manifest.json',output),JSON.stringify({pipeline:'editable-three-head-216-v1',stagingOnly:true,publicAssetsModified:false,geometry:{head:72,body:144,total:216},characters,forbiddenOperationsUsed:[]},null,2)+'\n');
console.log('12 source-rendered candidates exported to separate staging runtime assets; production remains unchanged.');
