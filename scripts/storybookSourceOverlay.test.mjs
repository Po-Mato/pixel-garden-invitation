import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {assertPaintedSourceOverlay,blendPaintedSourcePixels} from './lib/paintedSourceOverlay.mjs';
async function sourcePrior(rgba,overlay){
  return blendPaintedSourcePixels(rgba,await sharp(overlay).ensureAlpha().raw().toBuffer(),4);
}
const base = new URL('../character-assets/rigs/guest-07/storybook-source-v1/', import.meta.url);
async function combinedSourceOverlays(base,files,info){
  const inputs=await Promise.all(files.map(async file=>{const bytes=await readFile(new URL(file,base));assertPaintedSourceOverlay(file,bytes,await sharp(bytes).metadata(),info);return {input:bytes};}));
  return sharp({create:{width:info.width,height:info.height,channels:4,background:'#00000000'}}).composite(inputs).ensureAlpha().raw().toBuffer();
}
test('source overlays cannot become raster frame-patch inputs', () => {
  const size = {width: 992, height: 1586}, metadata = {...size, format: 'svg'};
  assert.doesNotThrow(() => assertPaintedSourceOverlay('shade.svg', Buffer.from('<svg><path d="M1 1L2 2"/></svg>'), metadata, size));
  assert.throws(() => assertPaintedSourceOverlay('frame.png', Buffer.from('png'), {...metadata, format: 'png'}, size), /editable SVG/);
  assert.throws(() => assertPaintedSourceOverlay('shade.svg', Buffer.from('<svg><image href="frame.png"/></svg>'), metadata, size), /raster patches/);
  assert.throws(() => assertPaintedSourceOverlay('shade.svg', Buffer.from('<svg/>'), {...metadata, width: 192}, size), /source coordinates/);
});
test('guest02 soft back skirt material preserves cream waistband, central pattern and alpha',async()=>{
  const base=new URL('../character-assets/rigs/guest-02/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('body-registration.json',base)));
  const parts=rig.parts.filter(p=>p.sourceOverlays?.includes('sources/skirt-back-shading-study-v1.svg'));
  assert.deepEqual(parts.map(p=>p.id),['skirt-back']);
  assert.ok(rig.parts.every(p=>!p.sourceOverlays?.includes('sources/torso-back-soft-seam-study-v1.svg')),'Rejected white-jeogori darkening must remain unregistered');
  const p=parts[0];assert.equal(p.mirrored,false);assert.equal(p.parent,'pelvis');
  const source=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const output=await sharp(await readFile(new URL(`generated/${p.id}.png`,base))).ensureAlpha().raw().toBuffer();
  const bytes=await readFile(new URL(p.sourceOverlays[0],base));
  assertPaintedSourceOverlay(p.sourceOverlays[0],bytes,await sharp(bytes).metadata(),source.info);
  const overlay=await combinedSourceOverlays(base,p.sourceOverlays,source.info);
  for(let i=0;i<alpha.length;i++){
    assert.equal(output[i*4+3],alpha[i]);
    const x=i%source.info.width,y=Math.floor(i/source.info.width);
    if(y<300||(x>=400&&x<=650&&y<1250))assert.equal(overlay[i*4+3],0,'Cream waistband and central patterned panel must be untouched');
    if(alpha[i]===255&&overlay[i*4+3]===0)assert.deepEqual(output.subarray(i*4,i*4+3),source.data.subarray(i*3,i*3+3));
  }
});
test('guest06 rejects ineffective sole material and preserves original source pixels',async()=>{
  const base=new URL('../character-assets/rigs/guest-06/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('body-registration.json',base)));
  assert.ok(rig.parts.every(p=>!p.sourceOverlays?.includes('sources/sole-back-study-v1.svg')));
  const parts=rig.parts.filter(p=>['legLeft-back','legRight-back'].includes(p.id));
  assert.deepEqual(parts.map(p=>p.id),['legLeft-back','legRight-back']);
  for(const p of parts){
    assert.equal(p.mirrored,false);assert.equal(p.direction,'back');
    assert.equal(p.source,'../../guest-05/storybook-directions-v1/sources/leg-back-v1.png');
    const source=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const mask=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
    const result=await sharp(await readFile(new URL(`generated/${p.id}.png`,base))).ensureAlpha().raw().toBuffer();
    for(let i=0;i<mask.length;i++){
      assert.equal(result[i*4+3],mask[i]);
      if(mask[i]===255)assert.deepEqual(result.subarray(i*4,i*4+3),source.data.subarray(i*3,i*3+3));
    }
  }
});
test('guest06 independent skirt shading preserves original alpha, waistbands and central pleats',async()=>{
  const base=new URL('../character-assets/rigs/guest-06/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('body-registration.json',base)));
  const parts=rig.parts.filter(p=>p.sourceOverlays?.length);
  assert.deepEqual(parts.map(p=>p.id),['skirt-back']);
  assert.ok(rig.parts.every(p=>!p.sourceOverlays?.includes('sources/skirt-left-seam-study-v1.svg')));
  for(const p of parts){assert.equal(p.mirrored,false);assert.equal(p.parent,'pelvis');
  const source=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const mask=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const result=await sharp(await readFile(new URL(`generated/${p.id}.png`,base))).ensureAlpha().raw().toBuffer();
  const bytes=await readFile(new URL(p.sourceOverlays[0],base));
  assertPaintedSourceOverlay(p.sourceOverlays[0],bytes,await sharp(bytes).metadata(),source.info);
  const overlay=await sharp(bytes).ensureAlpha().raw().toBuffer();
  for(let i=0;i<mask.length;i++){
    assert.equal(result[i*4+3],mask[i]);
    const x=i%source.info.width,y=Math.floor(i/source.info.width);
    if(y<300||(x>=400&&x<=650&&y<1300))assert.equal(overlay[i*4+3],0);
    if(mask[i]===255&&overlay[i*4+3]===0)assert.deepEqual(result.subarray(i*4,i*4+3),source.data.subarray(i*3,i*3+3));
  }
  }
});
test('guest11 soft cloth sides preserve cream centers, cuffs, shoes and alpha without rejected hard seams',async()=>{
  const green=new URL('../character-assets/rigs/guest-11/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('body-registration.json',green)));
  assert.ok(rig.parts.every(p=>!p.sourceOverlays?.some(f=>f.endsWith('-seam-study-v1.svg'))),'Rejected hard contour must not be registered');
  const parts=rig.parts.filter(p=>['legLeft-front','legRight-front'].includes(p.id));
  assert.deepEqual(parts.map(p=>p.id),['legLeft-front','legRight-front']);
  assert.equal(new Set(parts.map(p=>p.source)).size,2,'Two independent sources, not a mirror');
  for(const p of parts){
    assert.equal(p.direction,'front');assert.equal(p.mirrored,false);
    assert.deepEqual(p.sourceOverlays,[`sources/${p.id}-soft-cloth-study-v1.svg`]);
    const source=await sharp(await readFile(new URL(p.source,green))).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const mask=await sharp(await readFile(new URL(p.matte,green))).ensureAlpha().extractChannel(3).raw().toBuffer();
    const rendered=await sharp(await readFile(new URL(`generated/${p.id}.png`,green))).ensureAlpha().raw().toBuffer();
    const bytes=await readFile(new URL(p.sourceOverlays[0],green));
    assertPaintedSourceOverlay(p.sourceOverlays[0],bytes,await sharp(bytes).metadata(),source.info);
    const overlay=await sharp(bytes).ensureAlpha().raw().toBuffer();
    for(let i=0;i<mask.length;i++){
      assert.equal(rendered[i*4+3],mask[i]);
      const x=i%source.info.width,y=Math.floor(i/source.info.width);
      if(y<100||y>=1700||(x>=300&&x<=430))assert.equal(overlay[i*4+3],0,'Central cream, cuffs and footwear must remain unchanged');
      if(mask[i]===255&&overlay[i*4+3]===0)assert.deepEqual(rendered.subarray(i*4,i*4+3),source.data.subarray(i*3,i*3+3));
    }
  }
});
test('guest12 back calf material preserves shared donor artwork, cream centers, cuff and shoes',async()=>{
  const hanbok=new URL('../character-assets/rigs/guest-12/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('body-registration.json',hanbok)));
  const parts=rig.parts.filter(p=>p.sourceOverlays?.includes('sources/calf-back-shading-study-v1.svg'));
  assert.deepEqual(parts.map(p=>p.id),['legLeft-back','legRight-back']);
  for(const p of parts){
    assert.equal(p.source,'../../guest-11/storybook-source-v1/sources/leg-back-v1.png');
    assert.equal(p.direction,'back');assert.equal(p.mirrored,false);
    assert.deepEqual(p.sourceOverlays,['sources/calf-back-shading-study-v1.svg']);
    const source=await sharp(await readFile(new URL(p.source,hanbok))).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const mask=await sharp(await readFile(new URL(p.matte,hanbok))).ensureAlpha().extractChannel(3).raw().toBuffer();
    const rendered=await sharp(await readFile(new URL(`generated/${p.id}.png`,hanbok))).ensureAlpha().raw().toBuffer();
    const bytes=await readFile(new URL(p.sourceOverlays[0],hanbok));
    assertPaintedSourceOverlay(p.sourceOverlays[0],bytes,await sharp(bytes).metadata(),source.info);
    const overlay=await sharp(bytes).ensureAlpha().raw().toBuffer();
    for(let i=0;i<mask.length;i++){
      assert.equal(rendered[i*4+3],mask[i]);
      const x=i%source.info.width,y=Math.floor(i/source.info.width);
      if(y<1250||y>=1700||(x>=280&&x<=440))assert.equal(overlay[i*4+3],0,'Only the visible calf seam may be shaded');
      if(mask[i]===255&&overlay[i*4+3]===0)assert.deepEqual(rendered.subarray(i*4,i*4+3),source.data.subarray(i*3,i*3+3));
    }
  }
});
test('beige right-view shading retains all source alpha and excludes cuff, hand and shoe artwork', async () => {
  const beige = new URL('../character-assets/rigs/guest-09/storybook-source-v1/', import.meta.url);
  const rig = JSON.parse(await readFile(new URL('body-registration.json', beige)));
  const reviewed = ['legLeft-right', 'legRight-right', 'armLeft-right', 'armRight-right', 'torso-right'];
  assert.deepEqual(rig.parts.filter(p => p.sourceOverlays?.length).map(p => p.id), reviewed);
  for (const id of reviewed) {
    const part = rig.parts.find(p => p.id === id);
    const source = await sharp(await readFile(new URL(part.source, beige))).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const mask = await sharp(await readFile(new URL(part.matte, beige))).ensureAlpha().extractChannel(3).raw().toBuffer();
    const rendered = await sharp(await readFile(new URL(`generated/${id}.png`, beige))).ensureAlpha().raw().toBuffer();
    const inputs=[];
    for(const file of part.sourceOverlays){
      const bytes=await readFile(new URL(file,beige));
      assertPaintedSourceOverlay(file,bytes,await sharp(bytes).metadata(),source.info);
      inputs.push({input:bytes});
    }
    const overlay=await sharp({create:{width:source.info.width,height:source.info.height,channels:4,background:'#00000000'}}).composite(inputs).ensureAlpha().raw().toBuffer();
    for (let i=0;i<mask.length;i++) {
      assert.equal(rendered[i*4+3],mask[i],`${id}: silhouette must remain unchanged`);
      if (mask[i]===255 && overlay[i*4+3]===0) assert.deepEqual(rendered.subarray(i*4,i*4+3),source.data.subarray(i*3,i*3+3),`${id}: unpainted original RGB must survive`);
      const y=Math.floor(i/source.info.width);
      if ((id.startsWith('arm')&&y>=1670)||(id.startsWith('leg')&&y>=1940)) assert.equal(overlay[i*4+3],0,`${id}: protected cuff/skin or shoe region`);
    }
  }
});
test('rose directional costume shading preserves silhouette, unpainted colors and independent source coordinates', async () => {
  const rose = new URL('../character-assets/rigs/guest-08/storybook-source-v1/', import.meta.url);
  const rig = JSON.parse(await readFile(new URL('body-registration.json', rose)));
  const parts = rig.parts.filter(p => p.sourceOverlays?.length);
  assert.deepEqual(parts.map(p => p.id), ['skirt-right', 'torso-right', 'skirt-back']);
  for (const part of parts) {
    assert.equal(part.mirrored,false);
    const source = await sharp(await readFile(new URL(part.source, rose))).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const mask = await sharp(await readFile(new URL(part.matte, rose))).ensureAlpha().extractChannel(3).raw().toBuffer();
    const rendered = await sharp(await readFile(new URL(`generated/${part.id}.png`, rose))).ensureAlpha().raw().toBuffer();
    const bytes = await readFile(new URL(part.sourceOverlays[0], rose));
    assertPaintedSourceOverlay(part.sourceOverlays[0], bytes, await sharp(bytes).metadata(), source.info);
    const overlay = await sharp(bytes).ensureAlpha().raw().toBuffer();
    for (let i=0;i<mask.length;i++) {
      assert.equal(rendered[i*4+3], mask[i]);
      if(mask[i]===255 && overlay[i*4+3]===0) assert.deepEqual(rendered.subarray(i*4,i*4+3), source.data.subarray(i*3,i*3+3));
      if(part.id==='torso-right' && Math.floor(i/source.info.width)>=740 && i%source.info.width>=700) assert.equal(overlay[i*4+3],0,'Belt knot and ribbon stay unpainted');
      if(part.id==='skirt-back'){
        const x=i%source.info.width,y=Math.floor(i/source.info.width);
        if(y<300||(x>=350&&x<=650&&y<1500))assert.equal(overlay[i*4+3],0,'Back waistband and central pleats stay unpainted');
      }
    }
  }
});
test('guest09 calf seam preserves the thigh, cuff and shoe colors with fixed source geometry',async()=>{
  const beige=new URL('../character-assets/rigs/guest-09/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('body-registration.json',beige)));
  const parts=rig.parts.filter(p=>p.sourceOverlays?.includes('sources/calf-right-seam-study-v1.svg'));
  assert.deepEqual(parts.map(p=>p.id),['legLeft-right','legRight-right']);
  const p=parts[0];
  const source=await sharp(await readFile(new URL(p.source,beige))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const mask=await sharp(await readFile(new URL(p.matte,beige))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const rgba=Buffer.alloc(mask.length*4);
  for(let i=0;i<mask.length;i++)if(mask[i]){source.data.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=mask[i];}
  const prior=await sourcePrior(rgba,await readFile(new URL(p.sourceOverlays[0],beige)));
  const overlay=await sharp(await readFile(new URL('sources/calf-right-seam-study-v1.svg',beige))).ensureAlpha().raw().toBuffer();
  for(const part of parts){
    assert.equal(part.direction,'right');assert.equal(part.mirrored,false);
    assert.deepEqual(part.sourceOverlays,['sources/leg-right-edge-shading-v1.svg','sources/calf-right-seam-study-v1.svg']);
    const rendered=await sharp(await readFile(new URL(`generated/${part.id}.png`,beige))).ensureAlpha().raw().toBuffer();
    for(let i=0;i<mask.length;i++){
      assert.equal(rendered[i*4+3],mask[i]);
      const y=Math.floor(i/source.info.width);
      if(y<1000||y>=1740)assert.equal(overlay[i*4+3],0,'Thigh, cuff and shoe source regions cannot be repainted');
      if(mask[i]===255&&overlay[i*4+3]===0)assert.deepEqual(rendered.subarray(i*4,i*4+3),prior.subarray(i*4,i*4+3));
    }
  }
});
test('navy right costume shading preserves the cream belt, bare forearm and original alpha', async () => {
  const navy = new URL('../character-assets/rigs/guest-10/storybook-source-v1/', import.meta.url);
  const rig = JSON.parse(await readFile(new URL('body-registration.json', navy)));
  const parts = rig.parts.filter(p => p.sourceOverlays?.length);
  assert.deepEqual(parts.map(p => p.id), ['skirt-right', 'torso-right', 'armLeft-right']);
  for (const part of parts) {
    const source = await sharp(await readFile(new URL(part.source, navy))).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const mask = await sharp(await readFile(new URL(part.matte, navy))).ensureAlpha().extractChannel(3).raw().toBuffer();
    const rendered = await sharp(await readFile(new URL(`generated/${part.id}.png`, navy))).ensureAlpha().raw().toBuffer();
    const inputs=[];
    for(const file of part.sourceOverlays){
      const bytes=await readFile(new URL(file,navy));
      assertPaintedSourceOverlay(file,bytes,await sharp(bytes).metadata(),source.info);
      inputs.push({input:bytes});
    }
    const overlay=await sharp({create:{width:source.info.width,height:source.info.height,channels:4,background:'#00000000'}}).composite(inputs).ensureAlpha().raw().toBuffer();
    for (let i=0;i<mask.length;i++) {
      assert.equal(rendered[i*4+3],mask[i]);
      if(mask[i]===255 && overlay[i*4+3]===0) assert.deepEqual(rendered.subarray(i*4,i*4+3),source.data.subarray(i*3,i*3+3));
      const y=Math.floor(i/source.info.width);
      if((part.id==='torso-right'&&y>=742&&y<=808)||(part.id==='armLeft-right'&&y>=690)) assert.equal(overlay[i*4+3],0,'Protected cream belt or skin must not be shaded');
    }
  }
});
test('editable costume shading keeps the original source silhouette exactly', async () => {
  const rig = JSON.parse(await readFile(new URL('body-registration.json', base)));
  const reviewed = ['skirt-front', 'skirt-left', 'skirt-right', 'skirt-back'];
  assert.deepEqual(rig.parts.filter(p => p.sourceOverlays?.length && !p.id.startsWith('leg') && p.id!=='bag-front').map(p => p.id), reviewed, 'Costume shading is limited to the individually reviewed skirt parts; bag seam has its own contract');
  assert.equal(new Set(reviewed.map(id => rig.parts.find(p => p.id === id).sourceOverlays[0])).size, reviewed.length, 'Each direction has independently authored source coordinates');
  for (const id of reviewed) {
  const part = rig.parts.find(p => p.id === id);
  const expected = await sharp(await readFile(new URL(part.matte, base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const rendered = await sharp(await readFile(new URL(`generated/${id}.png`, base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  assert.deepEqual(rendered, expected, 'Source shading must not grow or erase any clothing alpha');
  const audit = JSON.parse(await readFile(new URL('generated/body-audit.json', base)));
  const layers = audit.parts.find(p => p.id === part.id).sourceOverlays;
  assert.equal(layers.length, {'skirt-front':2,'skirt-left':1,'skirt-right':3,'skirt-back':2}[id]);
  for(const [index,layer] of layers.entries()){
    assert.equal(layer.blend, 'source-atop');
    assert.equal(layer.sha256, createHash('sha256').update(await readFile(new URL(part.sourceOverlays[index], base))).digest('hex'));
  }
  }
});
test('guest10 localized skirt seam preserves its waistband, central pleats, hem and source alpha',async()=>{
  const navy=new URL('../character-assets/rigs/guest-10/storybook-source-v1/',import.meta.url);
  const rig=JSON.parse(await readFile(new URL('body-registration.json',navy)));
  const changed=rig.parts.filter(p=>p.sourceOverlays?.includes('sources/skirt-right-seam-study-v1.svg'));
  assert.deepEqual(changed.map(p=>p.id),['skirt-right']);
  const p=changed[0];
  assert.deepEqual(p.sourceOverlays,['sources/skirt-right-edge-shading-v1.svg','sources/skirt-right-seam-study-v1.svg']);
  assert.equal(p.direction,'right');assert.equal(p.mirrored,false);
  const source=await sharp(await readFile(new URL(p.source,navy))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const mask=await sharp(await readFile(new URL(p.matte,navy))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const rgba=Buffer.alloc(mask.length*4);
  for(let i=0;i<mask.length;i++)if(mask[i]){source.data.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=mask[i];}
  const prior=await sourcePrior(rgba,await readFile(new URL(p.sourceOverlays[0],navy)));
  const overlay=await sharp(await readFile(new URL(p.sourceOverlays[1],navy))).ensureAlpha().raw().toBuffer();
  const rendered=await sharp(await readFile(new URL('generated/skirt-right.png',navy))).ensureAlpha().raw().toBuffer();
  for(let i=0;i<mask.length;i++){
    assert.equal(rendered[i*4+3],mask[i]);
    const x=i%source.info.width,y=Math.floor(i/source.info.width);
    if(y<900||y>=1300||(x>=350&&x<=650))assert.equal(overlay[i*4+3],0,'Waistband, central pleats and hem cannot be repainted');
    if(mask[i]===255&&overlay[i*4+3]===0)assert.deepEqual(rendered.subarray(i*4,i*4+3),prior.subarray(i*4,i*4+3));
  }
});
test('guest07 front lace material preserves its independent source alpha, waistband and pleats',async()=>{
  const rig=JSON.parse(await readFile(new URL('body-registration.json',base)));
  const p=rig.parts.find(p=>p.id==='skirt-front');
  assert.deepEqual(p.sourceOverlays,['sources/skirt-front-edge-shading-v1.svg','sources/skirt-front-hem-study-v1.svg']);
  assert.equal(p.mirrored,false);assert.equal(p.parent,'pelvis');
  assert.deepEqual(p.sourcePivot,[500,70]);assert.deepEqual(p.pivot,[96,171]);assert.equal(p.scale,0.0575);
  const source=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const mask=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const rgba=Buffer.alloc(mask.length*4);
  for(let i=0;i<mask.length;i++)if(mask[i]){source.data.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=mask[i];}
  const prior=await sourcePrior(rgba,await readFile(new URL(p.sourceOverlays[0],base)));
  const bytes=await readFile(new URL(p.sourceOverlays[1],base));
  assertPaintedSourceOverlay(p.sourceOverlays[1],bytes,await sharp(bytes).metadata(),source.info);
  const matte=await readFile(new URL(p.matte,base),'utf8');
  assert.equal(bytes.toString().match(/ d="([^"]+)"/)[1],matte.match(/ d="([^"]+)"/)[1]);
  const overlay=await sharp(bytes).ensureAlpha().raw().toBuffer();
  const result=await sharp(await readFile(new URL('generated/skirt-front.png',base))).ensureAlpha().raw().toBuffer();
  let changed=0;
  for(let i=0;i<mask.length;i++){
    assert.equal(result[i*4+3],mask[i]);
    if(Math.floor(i/source.info.width)<1300)assert.equal(overlay[i*4+3],0);
    if(mask[i]===255){
      const same=result.subarray(i*4,i*4+3).equals(prior.subarray(i*4,i*4+3));
      if(overlay[i*4+3]===0)assert.ok(same);else if(!same)changed++;
    }
  }
  assert.ok(changed>0);
});
test('guest07 left lace material preserves its own contour, waistband and upper pleats',async()=>{
  const rig=JSON.parse(await readFile(new URL('body-registration.json',base)));
  const p=rig.parts.find(p=>p.id==='skirt-left');
  assert.deepEqual(p.sourceOverlays,['sources/skirt-left-hem-study-v1.svg']);
  assert.equal(p.mirrored,false);assert.equal(p.parent,'pelvis');assert.deepEqual(p.sourcePivot,[402,65]);
  const source=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const mask=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const rendered=await sharp(await readFile(new URL('generated/skirt-left.png',base))).ensureAlpha().raw().toBuffer();
  const bytes=await readFile(new URL(p.sourceOverlays[0],base));
  assertPaintedSourceOverlay(p.sourceOverlays[0],bytes,await sharp(bytes).metadata(),source.info);
  const matteSvg=await readFile(new URL(p.matte,base),'utf8');
  assert.equal(bytes.toString().match(/ d="([^"]+)"/)[1],matteSvg.match(/ d="([^"]+)"/)[1],'Use left source silhouette, never a mirrored right contour');
  const overlay=await sharp(bytes).ensureAlpha().raw().toBuffer();
  let changed=0;
  for(let i=0;i<mask.length;i++){
    assert.equal(rendered[i*4+3],mask[i]);
    if(Math.floor(i/source.info.width)<1300)assert.equal(overlay[i*4+3],0);
    if(mask[i]===255){
      const same=rendered.subarray(i*4,i*4+3).equals(source.data.subarray(i*3,i*3+3));
      if(overlay[i*4+3]===0)assert.ok(same);else if(!same)changed++;
    }
  }
  assert.ok(changed>0);
});
test('guest07 right lace hem shading retains the source contour and never paints the upper skirt',async()=>{
  const rig=JSON.parse(await readFile(new URL('body-registration.json',base)));
  const p=rig.parts.find(p=>p.id==='skirt-right');
  assert.deepEqual(p.sourceOverlays,['sources/skirt-right-edge-shading-v1.svg','sources/skirt-right-hem-study-v1.svg','sources/skirt-right-lace-contour-v4.svg']);
  const source=await sharp(await readFile(new URL(p.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const mask=await sharp(await readFile(new URL(p.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const rgba=Buffer.alloc(mask.length*4);
  for(let i=0;i<mask.length;i++)if(mask[i]){source.data.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=mask[i];}
  const original=await sourcePrior(rgba,await readFile(new URL(p.sourceOverlays[0],base)));
  const rendered=await sharp(await readFile(new URL('generated/skirt-right.png',base))).ensureAlpha().raw().toBuffer();
  const bytes=await readFile(new URL(p.sourceOverlays[1],base));
  assertPaintedSourceOverlay(p.sourceOverlays[1],bytes,await sharp(bytes).metadata(),source.info);
  const overlay=await combinedSourceOverlays(base,p.sourceOverlays.slice(1),source.info);
  let changed=0;
  for(let i=0;i<mask.length;i++){
    assert.equal(rendered[i*4+3],mask[i]);
    if(Math.floor(i/source.info.width)<1300)assert.equal(overlay[i*4+3],0);
    if(mask[i]===255&&overlay[i*4+3]===0)assert.deepEqual(rendered.subarray(i*4,i*4+3),original.subarray(i*4,i*4+3));
    if(!rendered.subarray(i*4,i*4+3).equals(original.subarray(i*4,i*4+3)))changed++;
  }
  assert.ok(changed>0);
});
test('guest07 front bag seam preserves the cream panel, original alpha and body-side binding',async()=>{
  const rig=JSON.parse(await readFile(new URL('body-registration.json',base)));
  const bags=rig.parts.filter(p=>p.id.startsWith('bag'));
  assert.deepEqual(bags.filter(p=>p.sourceOverlays?.length).map(p=>p.id),['bag-front']);
  const part=bags.find(p=>p.id==='bag-front');
  assert.equal(part.parent,'handLeft');assert.equal(part.bodySide,'left');assert.equal(part.mirrored,false);
  const source=await sharp(await readFile(new URL(part.source,base))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const mask=await sharp(await readFile(new URL(part.matte,base))).ensureAlpha().extractChannel(3).raw().toBuffer();
  const rendered=await sharp(await readFile(new URL('generated/bag-front.png',base))).ensureAlpha().raw().toBuffer();
  const bytes=await readFile(new URL(part.sourceOverlays[0],base));
  assertPaintedSourceOverlay(part.sourceOverlays[0],bytes,await sharp(bytes).metadata(),source.info);
  const overlay=await sharp(bytes).ensureAlpha().raw().toBuffer();
  for(let i=0;i<mask.length;i++){
    assert.equal(rendered[i*4+3],mask[i]);
    const x=i%source.info.width,y=Math.floor(i/source.info.width);
    if(x>=310&&x<=940&&y>=330&&y<=855)assert.equal(overlay[i*4+3],0,'Cream inner panel must stay unpainted');
    if(mask[i]===255&&overlay[i*4+3]===0)assert.deepEqual(rendered.subarray(i*4,i*4+3),source.data.subarray(i*3,i*3+3));
  }
});
test('guest07 independent right and back shoe shading preserves source alpha and cream interior', async () => {
  const rig = JSON.parse(await readFile(new URL('body-registration.json', base)));
  const parts = rig.parts.filter(p => p.id.startsWith('leg') && p.sourceOverlays?.length);
  assert.deepEqual(parts.map(p => p.id), ['legLeft-right', 'legRight-right', 'legLeft-back', 'legRight-back']);
  for (const part of parts) {
    assert.ok(['right','back'].includes(part.direction));
    assert.equal(part.mirrored, false);
    assert.deepEqual(part.sourceOverlays, part.direction==='right'?['sources/leg-right-edge-shading-v1.svg','sources/shoe-right-welt-v4.svg']:['sources/shoe-back-welt-v4.svg']);
    const source = await sharp(await readFile(new URL(part.source, base))).removeAlpha().raw().toBuffer({resolveWithObject: true});
    const expectedAlpha = await sharp(await readFile(new URL(part.matte, base))).ensureAlpha().extractChannel(3).raw().toBuffer();
    const result = await sharp(await readFile(new URL(`generated/${part.id}.png`, base))).ensureAlpha().raw().toBuffer();
    const bytes = await readFile(new URL(part.sourceOverlays[0], base));
    assertPaintedSourceOverlay(part.sourceOverlays[0], bytes, await sharp(bytes).metadata(), source.info);
    const overlay = await combinedSourceOverlays(base,part.sourceOverlays,source.info);
    let changed = 0;
    for (let i = 0; i < expectedAlpha.length; i++) {
      const x = i % source.info.width, y = Math.floor(i / source.info.width);
      assert.equal(result[i * 4 + 3], expectedAlpha[i]);
      const cream=part.direction==='right'?(x>=490&&x<=710&&y>=1280&&y<=1300):(x>=490&&x<=570&&y>=1240&&y<=1280);
      if (y < 1040 || cream) {
        assert.equal(overlay[i * 4 + 3], 0, 'Upper leg and cream shoe interior are protected');
      }
      if (expectedAlpha[i] === 255 && overlay[i * 4 + 3] === 0) {
        assert.deepEqual(result.subarray(i * 4, i * 4 + 3), source.data.subarray(i * 3, i * 3 + 3));
      }
      if (expectedAlpha[i] === 255 && overlay[i * 4 + 3] > 0) changed++;
    }
    assert.ok(changed > 0, 'Study must paint the actual source, not an empty region');
  }
});
