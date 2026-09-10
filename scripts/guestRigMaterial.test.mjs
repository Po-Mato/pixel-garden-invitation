import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {renderRigMaterial} from './lib/guestRigMaterial.mjs';
const svg=s=>'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">'+s+'</svg>';
test('local fabric material softens interior folds without changing alpha or collar',async()=>{
 const original='<rect x="2" y="2" width="20" height="20" rx="2" fill="#334568"/><rect x="6" y="2" width="12" height="3" fill="#fff5df"/><path d="M6 10H18M6 14H18" stroke="#13213a" stroke-width="2"/>';
 const material={type:'soft-fabric',blur:1.5,feather:.4,opacity:.9,regions:[[6,8,12,9]]};
 const a=await sharp(Buffer.from(svg(original))).ensureAlpha().raw().toBuffer();
 const b=await sharp(Buffer.from(svg(renderRigMaterial(original,material,'back')))).ensureAlpha().raw().toBuffer();
 for(let i=3;i<a.length;i+=4)assert.equal(a[i],b[i],'source alpha must not grow');
 assert.deepEqual(a.subarray((3*24+10)*4,(3*24+11)*4),b.subarray((3*24+10)*4,(3*24+11)*4));
 assert.notDeepEqual(a,b);
 assert.throws(()=>renderRigMaterial(original,{...material,regions:[[0,0,-1,2]]},'back'));
});
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
test('fabric bounds use original art coordinates before downscaled joint placement',async()=>{
 const original='<rect x="20" y="20" width="200" height="200" fill="#334568"/><rect x="50" y="90" width="140" height="20" fill="#14213a"/>';
 const material={type:'soft-fabric',bounds:[0,0,240,240],blur:15,feather:4,opacity:.9,regions:[[50,70,140,90]],protectedRegions:[[100,0,40,240]]};
 const wrap=part=>svg('<g transform="scale(.1)">'+part+'</g>');
 const a=await sharp(Buffer.from(wrap(original))).ensureAlpha().raw().toBuffer();
 const b=await sharp(Buffer.from(wrap(renderRigMaterial(original,material,'largeBack')))).ensureAlpha().raw().toBuffer();
 assert.notDeepEqual(a.subarray((10*24+7)*4,(10*24+8)*4),b.subarray((10*24+7)*4,(10*24+8)*4),'large-source material must not be clipped out');
 assert.deepEqual(a.subarray((10*24+12)*4,(10*24+13)*4),b.subarray((10*24+12)*4,(10*24+13)*4),'protected seam preserved');
 for(let i=3;i<a.length;i+=4)assert.equal(a[i],b[i]);
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
