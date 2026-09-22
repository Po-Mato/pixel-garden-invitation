import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-05/storybook-body-v1');
const out=path.join(base,'generated');
const common=path.join(root,'character-assets/rigs/common-three-head-216-v1');
const skeleton=JSON.parse(await fs.readFile(path.join(common,'skeleton.json')));
const motion=JSON.parse(await fs.readFile(path.join(common,'animations/dress-front.json')));
const rig=JSON.parse(await fs.readFile(path.join(base,'front-registration.json')));
assert.equal(rig.shadow.parent,'root');assert.deepEqual(rig.shadow.pivot,skeleton.bones.root.pivot);
const image=async file=>`<image width="192" height="288" href="data:image/svg+xml;base64,${(await fs.readFile(file)).toString('base64')}"/>`;
const part=async id=>image(path.join(out,`${id}-registered.svg`));
const joint=async id=>image(path.join(out,'joint-parts',`${id}.svg`));
const chain=id=>{const result=[];for(let p=id;p;p=skeleton.bones[p].parent)result.unshift(p);return result;};
const transform=(id,frame)=>chain(id).map(bone=>{const [x,y]=skeleton.bones[bone].pivot;return `translate(${x} ${y}) rotate(${frame.rotations[bone]||0}) translate(${-x} ${-y})`;}).join(' ');
const frames=[];
for(const [index,frame] of motion.frames.entries()){
  const layers=[await image(path.resolve(base,rig.shadow.source))];
  // Depth is an authored common projection offset, not a limb resize or pixel repair.
  for(const side of ['Right','Left'])for(const bone of ['thigh','calf','shoe']){const id=bone+side;layers.push(`<g transform="translate(0 ${frame.depth[side]||0}) ${transform(id,frame)}">${await joint(id)}</g>`);}
  layers.push(await image(path.join(base,'neck-front.svg')),await part('skirt'));
  layers.push(`<g transform="${transform('handLeft',frame)}">${await part('bag')}</g>`);
  for(const side of ['Right','Left'])for(const bone of ['upperArm','forearm','hand']){const id=bone+side;layers.push(`<g transform="${transform(id,frame)}">${await joint(id)}</g>`);}
  layers.push(await part('torso'),await part('head'));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${layers.join('')}</svg>`;
  await fs.writeFile(path.join(out,`front-walk-${index+1}.svg`),svg);
  const png=await sharp(Buffer.from(svg)).png().toBuffer(); frames.push(png);
  await fs.writeFile(path.join(out,`front-walk-${index+1}.png`),png);
}
assert.deepEqual(frames[1],frames[3]);assert.notDeepEqual(frames[0],frames[2]);
await sharp({create:{width:768,height:288,channels:4,background:'#00000000'}}).composite(frames.map((input,i)=>({input,left:i*192,top:0}))).png().toFile(path.join(out,'front-walk-strip.png'));
await sharp(path.join(out,'front-walk-strip.png')).flatten({background:'#263545'}).png().toFile(path.join(out,'front-walk-review.png'));
await fs.writeFile(path.join(out,'walk-audit.json'),JSON.stringify({status:'shared-dress-motion-first-visual-review',runtimeEligible:false,motionSource:'common-three-head-216-v1/animations/dress-front.json',neutralFramesIdentical:true,oppositeStrideImagesDistinct:true,forwardFeet:motion.frames.map(f=>f.forward),visualApproved:false},null,2)+'\n');
console.log('Rendered common dress front motion; visual approval pending.');
