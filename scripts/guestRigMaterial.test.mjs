import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {renderRigMaterial} from './lib/guestRigMaterial.mjs';
const svg=s=>'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">'+s+'</svg>';
test('authored inner fabric shading preserves cream interior and every alpha sample',async()=>{
 const original='<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3" fill="#f4e5cf"/>';
 const material={type:'inner-edge-shading',color:'#665549',radius:1.2,opacity:.45};
 const a=await sharp(Buffer.from(svg(original))).ensureAlpha().raw().toBuffer();
 const b=await sharp(Buffer.from(svg(renderRigMaterial(original,material,'skirt')))).ensureAlpha().raw().toBuffer();
 for(let i=3;i<a.length;i+=4)assert.equal(a[i],b[i]);
 const center=(12*24+12)*4;assert.deepEqual(a.subarray(center,center+4),b.subarray(center,center+4));
 assert.notDeepEqual(a,b);
 for(const invalid of [{...material,radius:0},{...material,opacity:2},{...material,color:'white'}])assert.throws(()=>renderRigMaterial('',invalid,'skirt'));
});
test('rig palette changes original-part colour while preserving alpha exactly',async()=>{
 const original='<rect x="4" y="4" width="16" height="16" rx="3" fill="#888888"/>';
 const material={type:'gradient-map',colors:['#302735','#817293','#b6a6c9','#ded3e8','#f5edf8']};
 const a=await sharp(Buffer.from(svg(original))).ensureAlpha().raw().toBuffer();
 const b=await sharp(Buffer.from(svg(renderRigMaterial(original,material,'skirt')))).ensureAlpha().raw().toBuffer();
 assert.notDeepEqual(a,b);for(let i=3;i<a.length;i+=4)assert.equal(a[i],b[i]);
 assert.equal(renderRigMaterial(original,null,'skirt'),original);
});
test('malformed material definitions fail rather than silently recolouring',()=>{
 assert.throws(()=>renderRigMaterial('',{type:'guess-colour'},'skirt'));
 assert.throws(()=>renderRigMaterial('',{type:'gradient-map',colors:['white','#000000']},'skirt'));
});
test('green pigment material preserves cream fabric and alpha',async()=>{
 const original='<rect width="12" height="24" fill="#f4e5cf"/><rect x="12" width="12" height="24" fill="#aab59e"/>';
 const material={type:'gradient-map',pigment:'green',colors:['#302735','#817293','#b6a6c9','#ded3e8','#f5edf8']};
 const a=await sharp(Buffer.from(svg(original))).ensureAlpha().raw().toBuffer();
 const b=await sharp(Buffer.from(svg(renderRigMaterial(original,material,'bodice')))).ensureAlpha().raw().toBuffer();
 assert.deepEqual(a.subarray(0,12*4),b.subarray(0,12*4));
 assert.notDeepEqual(a.subarray(12*4,24*4),b.subarray(12*4,24*4));
 for(let i=3;i<a.length;i+=4)assert.equal(a[i],b[i]);
});
