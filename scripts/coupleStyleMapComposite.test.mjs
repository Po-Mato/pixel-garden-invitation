import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from './lib/deterministicSharp.mjs';
import {renderCoupleStyleWorldFrame,characterSceneLayer,measureSceneEdge,assertCoupleStyleWorldCss} from './lib/coupleStyleMapComposite.mjs';

test('world transform preserves the authored foot point and expands into the padded audit canvas',async()=>{
 const frame=await sharp({create:{width:96,height:144,channels:4,background:'#00000000'}}).composite([{input:await sharp({create:{width:48,height:108,channels:4,background:'#808080'}}).png().toBuffer(),left:24,top:27}]).png().toBuffer();
 const sprite=await renderCoupleStyleWorldFrame(frame),{data,info}=await sharp(sprite).raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,84);assert.equal(info.height,104);
 const ys=[];for(let y=0;y<104;y++)if(data[(y*84+42)*4+3]>=128)ys.push(y);
 assert.equal(ys[0],20);assert.equal(ys.at(-1),83); // transformed planes y=20.5 .. 83.5 in padded region
 assert.ok(Math.abs(data[(45*84+42)*4]-128)<=1,'neutral grey stays neutral under the inner color treatment');
 const layer=await characterSceneLayer(sprite,'contrast(1)','rgba(0, 0, 0, 0)');
 const scene=await sharp({create:{width:84,height:104,channels:4,background:'#ffffff'}}).composite([{input:layer,left:0,top:0}]).raw().toBuffer();
 assert.ok(measureSceneEdge(scene,data).standard>1.2);
});
test('audit refuses a CSS geometry or tone mismatch',()=>{
 assert.throws(()=>assertCoupleStyleWorldCss(''),/assert|expression/i);
});
