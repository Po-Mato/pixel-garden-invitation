import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'character-assets/rigs/guest-05/storybook-head-matte-v1');
const out = path.join(base, 'generated/complete-head'); await fs.mkdir(out, { recursive: true });
const source = await fs.readFile(path.join(base, 'sources/hidden-back-hair-paint-v1.png'));
const mask = await fs.readFile(path.join(base, 'hidden-back-hair-matte.svg'));
const {data: rgb, info} = await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true});
assert.equal(info.width,1422); assert.equal(info.height,1106);
const alpha = await sharp(mask).ensureAlpha().extractChannel(3).raw().toBuffer();
const read = name => fs.readFile(path.join(base, name));
const face = await read('generated/hidden-forehead/face-with-hidden-skin.png');
const front = await read('generated/layers/frontHair.png');
const back = await read('generated/layers/backHair.png');
const frontAlpha = await sharp(front).ensureAlpha().extractChannel(3).raw().toBuffer();
const faceAlpha = await sharp(face).ensureAlpha().extractChannel(3).raw().toBuffer();
const rgba = Buffer.alloc(alpha.length*4); let count=0;
for(let i=0;i<alpha.length;i++) if(alpha[i] && (faceAlpha[i]===255 || frontAlpha[i]===255)) {
  for(let c=0;c<3;c++) rgba[i*4+c]=rgb[i*3+c]; rgba[i*4+3]=alpha[i]; count++;
}
const under = await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
const blank=()=>sharp({create:{width:info.width,height:info.height,channels:4,background:'#00000000'}});
const fullBack=await blank().composite([{input:under},{input:back}]).png().toBuffer();
// Composite source layers once; repeatedly flattening partial-alpha edges introduces rounding drift.
const faceVisible=await read('generated/layers/face.png');
const forehead=await read('generated/hidden-forehead/forehead.png');
const assembled=await blank().composite([{input:under},{input:back},{input:forehead},{input:faceVisible},{input:front}]).png().toBuffer();
assert.deepEqual(await sharp(assembled).raw().toBuffer(),await sharp(await read('generated/hidden-forehead/assembled.png')).raw().toBuffer());
for(const [name,p] of [['backHair',fullBack],['face',face],['frontHair',front],['assembled',assembled]]) await fs.writeFile(path.join(out,`${name}.png`),p);
const tiles=[];for(const [i,p] of [fullBack,face,front,assembled].entries())tiles.push({input:await sharp(p).resize(355).toBuffer(),left:i*355,top:0});
await sharp({create:{width:1420,height:280,channels:4,background:'#e4e8dd'}}).composite(tiles).png().toFile(path.join(out,'review.png'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
await fs.writeFile(path.join(out,'audit.json'),JSON.stringify({status:'front-head-hidden-materials-added',sourceSha256:hash(source),maskSha256:hash(mask),addedPixels:count,lockedAppearanceExactlyUnchanged:true,runtimeEligible:false,independentMotionApproved:false},null,2)+'\n');
console.log({addedPixels:count,lockedAppearanceExactlyUnchanged:true});
