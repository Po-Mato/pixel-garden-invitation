import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {readStorybook,storybookBase,boundsSvg,renderStorybook} from './render-guest05-storybook.mjs';
const source=await readStorybook();
const names=source.rig.parts.map(p=>p.id);
const raw=async svg=>(await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer());
const hash=b=>createHash('sha256').update(b).digest('hex');

test('23 genuinely separate editable vector parts with explicit common parents and pivots',()=>{
 assert.equal(names.length,23);assert.equal(new Set(names).size,23);
 for(const p of source.rig.parts){assert.ok(source.layers.has(p.id));assert.deepEqual(p.pivot,source.skeleton.bones[p.parent].pivot);assert.equal(p.mirrored,false);}
 for(const side of ['Left','Right'])for(const limb of ['upperArm','forearm','hand','thigh','calf','shoe'])assert.ok(names.includes(limb+side));
 for(const id of ['face','frontHair','backHair','neck','torso','jacket','pelvis','skirt','ribbon','handbag','shadow'])assert.ok(names.includes(id));
 assert.ok(!/<image\b|data:image|\btransform=/i.test(source.art));
});
test('exact 72/144/216 source geometry and genuine transparent background',async()=>{
 assert.deepEqual([source.rig.geometry.headHeight,source.rig.geometry.bodyHeight,source.rig.geometry.characterHeight],[72,144,216]);
 const body=source.svg(names.filter(n=>n!=='shadow'));
 const b=await boundsSvg(body);assert.deepEqual([b.top,b.bottom,b.height],[54,269,216]);
 const h=await boundsSvg(source.svg(['backHair','face','frontHair']),[0,54,192,72]);assert.equal(h.height,72);
 const pixels=await raw(body);
 for(let y=0;y<288;y++)for(let x=0;x<192;x++)if(x<50||x>146||y<53||y>270)assert.equal(pixels[(y*192+x)*4+3],0,'no white matte or glow outside artwork');
 for(let y=125;y<=138;y++)assert.ok(Array.from({length:25},(_,i)=>pixels[(y*192+84+i)*4+3]).some(a=>a>=128),'continuous opaque neck');
});
for(const[a,b]of [['neck','face'],['neck','torso'],['jacket','upperArmLeft'],['jacket','upperArmRight'],['upperArmLeft','forearmLeft'],['upperArmRight','forearmRight'],['forearmLeft','handLeft'],['forearmRight','handRight'],['thighLeft','calfLeft'],['thighRight','calfRight'],['calfLeft','shoeLeft'],['calfRight','shoeRight'],['torso','skirt'],['handLeft','handbag']])test(`${a}/${b}: authored neutral overlap, no copied seam pixels`,async()=>{
 const aa=await raw(source.svg([a])),bb=await raw(source.svg([b]));let overlap=0;
 for(let i=3;i<aa.length;i+=4)if(aa[i]>=128&&bb[i]>=128)overlap++;
 assert.ok(overlap>=3,`${overlap} opaque overlap pixels`);
});
test('cream fabric remains opaque and left-hand accessories are authored without mirroring',async()=>{
 const pixels=await raw(source.svg(['jacket','forearmLeft','forearmRight','shoeLeft','shoeRight','handbag']));let cream=0;
 for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]===255&&pixels[i]>=210&&pixels[i+1]>=195&&pixels[i+2]>=170)cream++;
 assert.ok(cream>300);assert.equal(source.rig.parts.find(p=>p.id==='handbag').parent,'handLeft');
 assert.equal(source.rig.asymmetry.mirroringAllowed,false);
});
test('deterministic source render with provenance, not a runtime or walk-cycle claim',async()=>{
 const a=await renderStorybook(),b=await renderStorybook();assert.equal(a.pngSha256,b.pngSha256);
 assert.equal(a.sourceSha256,hash(source.art));assert.equal(a.runtimeEnabled,false);
 assert.equal(a.conceptSha256,'49c46c13c6f36ca2249aa2176d91783286df9e40ceca9d2b003018e58882973f');
 for(const[w,h]of[[192,288],[96,144],[48,72]]){const file=w===192?'neutral.png':`neutral-${w}x${h}.png`;const m=await sharp(await readFile(new URL('generated/'+file,storybookBase))).metadata();assert.deepEqual([m.width,m.height,m.hasAlpha],[w,h,true]);}
 assert.ok(a.unimplemented.includes('walk-cycle'));
});
