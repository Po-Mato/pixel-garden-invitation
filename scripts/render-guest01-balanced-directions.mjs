// Isolated editable-source study. Does not write runtime or canonical generated assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {sourceVolumeBinding} from './lib/storybookSourceVolume.mjs';
import {packCharacterFrames} from './lib/packCharacterFrames.mjs';
import {alphaConnection} from './lib/storybookJointConnections.mjs';
import {assertPaintedSourceOverlay} from './lib/paintedSourceOverlay.mjs';
import {renderGuest01HeadSourceStudy} from './lib/guest01HeadSourceStudy.mjs';
import {beginPaintedRender,finishPaintedRender} from './lib/paintedRenderReceipt.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-01/storybook-source-v1');
const variant=process.argv[2]||'balanced-arms-four-direction-v2';
assert.ok(['balanced-arms-four-direction-v2','balanced-shading-v3'].includes(variant));
const canonical=process.argv[3]==='--canonical';assert.ok(!process.argv[3]||canonical);
if(canonical)assert.equal(variant,'balanced-shading-v3');
const out=canonical?path.join(base,'generated/balanced-v3'):path.join(base,'review',variant);
await fs.mkdir(out,{recursive:true});
const read=async p=>JSON.parse(await fs.readFile(p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const proposalFile=canonical?path.join(base,'balanced-source-recipe-v3.json'):path.join(out,'registration.json');
const proposal=await read(proposalFile);
if(canonical)assert.deepEqual(proposal,await read(path.join(base,'review',variant,'registration.json')),'Canonical recipe must match reviewed source');
const rig=await read(path.join(base,'body-registration.json'));
const common=path.dirname(path.resolve(base,rig.skeleton));
const skeleton=await read(path.resolve(base,rig.skeleton));
const contact=await read(path.join(common,rig.contactAnimation));
const cloth=await read(path.join(common,rig.clothAnimation));
const layout=await read(path.join(common,'painted-joint-regions-v1.json'));
assert.deepEqual(skeleton.canvas,[192,288]);assert.equal(skeleton.geometry.characterHeight,216);
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${body}</svg>`;
const embed=b=>`<image width="192" height="288" href="data:image/svg+xml;base64,${b.toString('base64')}"/>`;
const image=async p=>embed(await fs.readFile(p));
const sourceAudit=[],sourceOverlayAudit=[],headSourceAudit=[],audit=[],tiles=[],comparison=[],connections=[];
const protectedFiles=['body-registration.json','head-registration.json',...proposal.directions.map(d=>`generated/${d}-body-study.png`)];
const protectedHashes=await Promise.all(protectedFiles.map(async f=>[f,hash(await fs.readFile(path.join(base,f)))]));
const receipt=await beginPaintedRender(root,[
 'scripts/render-guest01-balanced-directions.mjs','scripts/lib/guest01HeadSourceStudy.mjs',
 'scripts/lib/paintedHeadMaterial.mjs','scripts/lib/paintedSourceOverlay.mjs','scripts/lib/storybookSourceVolume.mjs',
 'scripts/lib/packCharacterFrames.mjs','scripts/lib/storybookJointConnections.mjs','pnpm-lock.yaml',proposalFile,
 path.join(base,'body-registration.json'),path.join(base,'head-registration.json'),path.join(base,'head-layers.json'),
 path.resolve(base,rig.skeleton),path.join(common,rig.contactAnimation),path.join(common,rig.clothAnimation),path.join(common,'painted-joint-regions-v1.json'),
 ...proposal.directions.map(d=>path.join(common,`animations/${rig.family}-${d}.json`)),
 ...proposal.parts.map(p=>path.join(base,p.source)),
 ...Object.values(proposal.sourceOverlays||{}).flat().map(f=>path.join(base,f)),
 ...Object.values(proposal.headSourceOverlays||{}).flat().map(f=>path.join(base,f)),
 ...rig.parts.flatMap(p=>[p.source,p.matte,p.vector,...Object.values(p.jointMasks||{})].filter(Boolean).map(f=>path.resolve(base,f))),
 ...rig.parts.filter(p=>!p.id.startsWith('arm')).map(p=>path.join(base,`generated/${p.id}-registered.svg`)),
 ...proposal.directions.flatMap(d=>['Left','Right'].flatMap(side=>['thigh','calf','shoe'].map(name=>path.join(base,`generated/${d}-${name}${side}-source.svg`))))
],['head','body','walk'].map(name=>path.join(base,`generated/${name}-render-receipt.json`)));
for(const [row,direction] of proposal.directions.entries()){
  const bones=direction==='front'?skeleton.bones:skeleton.projections[direction].bones;
  const motion=await read(path.join(common,`animations/${rig.family}-${direction}.json`));
  for(const [i,depth] of Object.entries(contact.directions[direction]||{}))Object.assign(motion.frames[i].depth,depth);
  const transform=(id,frame)=>{const chain=[];for(let p=id;p;p=bones[p].parent)chain.unshift(p);return chain.map(p=>{const [x,y]=bones[p].pivot;return `translate(${x} ${y}) rotate(${frame.rotations[p]||0}) translate(${-x} ${-y})`;}).join(' ');};
  const parts=rig.parts.filter(p=>p.direction===direction).sort((a,b)=>(a.layer==='nearArm'?1:0)-(b.layer==='nearArm'?1:0));
  const materials=new Map(),joints=new Map();
  for(const p of parts){
    const edit=proposal.parts.find(a=>a.id===p.id);
    if(edit){
      assert.ok(p.id.startsWith('arm'));assert.notEqual(p.mirrored,true);
      assert.deepEqual(p.pivot,bones[p.parent].pivot);
      const bytes=await fs.readFile(path.join(base,edit.source));
      const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      for(const [x,y] of [edit.sourcePivot,edit.sourceEnd])assert.ok(data[(y*info.width+x)*4+3]>128,`Opaque authored landmark: ${p.id}`);
      for(const [x,y] of [[0,0],[200,700],[900,1400]])assert.equal(data[(y*info.width+x)*4+3],0,`Transparent exterior: ${p.id}`);
      const s=[edit.sourceEnd[0]-edit.sourcePivot[0],edit.sourceEnd[1]-edit.sourcePivot[1]],t=[p.targetEnd[0]-p.pivot[0],p.targetEnd[1]-p.pivot[1]];
      const scale=Math.hypot(...t)/Math.hypot(...s),angle=(Math.atan2(t[1],t[0])-Math.atan2(s[1],s[0]))*180/Math.PI;
      const sampleScale=Math.min(1,scale*rig.sourceSamplesPerOutputPixel);
      const sampled=await sharp(bytes).resize(Math.round(info.width*sampleScale),Math.round(info.height*sampleScale),{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
      const material=`<g transform="translate(${p.pivot}) rotate(${angle}) scale(${scale}) translate(${-edit.sourcePivot[0]} ${-edit.sourcePivot[1]})"><image width="${info.width}" height="${info.height}" href="data:image/png;base64,${sampled.toString('base64')}"/></g>`;
      materials.set(p.id,material);
      await fs.writeFile(path.join(out,`${p.id}-registered.svg`),svg(material));
      sourceAudit.push({...edit,pivot:p.pivot,targetEnd:p.targetEnd,parent:p.parent,scale,angle,sha256:hash(bytes),alphaPreserved:true,mirrored:false});
      const side=p.parent.endsWith('Left')?'Left':'Right',segments=[];
      for(const name of ['upperArm','forearm','hand']){
        const mask=await image(path.join(base,p.jointMasks[name]));
        const source=svg(`<defs><mask id="joint" maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="288">${mask}</mask></defs><g mask="url(#joint)">${material}</g>`);
        await fs.writeFile(path.join(out,`${direction}-${name}${side}-source.svg`),source);
        segments.push({id:name+side,side,kind:'arm',image:embed(Buffer.from(source))});
      }
      joints.set(p.id,segments);
    }else{
      assert.ok(!p.id.startsWith('arm'),'Every arm must have independent new artwork');
      let material=await image(path.join(base,`generated/${p.id}-registered.svg`));
      if(proposal.sourceOverlays?.[p.id]){
        // Rebuild the editable original part, before registration, never frame pixels.
        const source=await fs.readFile(path.join(base,p.source));
        const {data:rgb,info}=await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true});
        const alpha=await sharp(path.join(base,p.matte)).ensureAlpha().extractChannel(3).raw().toBuffer();
        const rgba=Buffer.alloc(alpha.length*4);for(let i=0;i<alpha.length;i++){rgb.copy(rgba,i*4,i*3,i*3+3);rgba[i*4+3]=alpha[i];}
        let clean=await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
        for(const file of proposal.sourceOverlays[p.id]){
          const bytes=await fs.readFile(path.join(base,file));assertPaintedSourceOverlay(file,bytes,await sharp(bytes).metadata(),info);
          clean=await sharp(clean).composite([{input:bytes,blend:'atop'}]).png().toBuffer();
          sourceOverlayAudit.push({part:p.id,file,sha256:hash(bytes),source:p.source,sourceSha256:hash(source),matte:p.matte,matteSha256:hash(await fs.readFile(path.join(base,p.matte))),blend:'atop',alphaPreserved:true});
        }
        assert.deepEqual(await sharp(clean).extractChannel(3).raw().toBuffer(),alpha,'Source shading must preserve silhouette');
        await fs.writeFile(path.join(out,`${p.id}-source.png`),clean);
        const sampleScale=Math.min(1,p.scale*rig.sourceSamplesPerOutputPixel);
        const sampled=await sharp(clean).resize(Math.round(info.width*sampleScale),Math.round(info.height*sampleScale),{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
        material=`<g transform="translate(${p.pivot}) scale(${p.scale}) translate(${-p.sourcePivot[0]} ${-p.sourcePivot[1]})"><image width="${info.width}" height="${info.height}" href="data:image/png;base64,${sampled.toString('base64')}"/></g>`;
        const originalVolume=sourceVolumeBinding(p,rig.sourceVolume);
        if(originalVolume.transform)material=`<g transform="${originalVolume.transform}">${material}</g>`;
        // Same SVG material boundary as canonical registered parts; otherwise
        // Cairo combines volume and registration resampling and changes edges.
        material=embed(Buffer.from(svg(material)));
      }
      const category=p.id.startsWith('torso-')?'torso':p.id.startsWith('skirt-')?'skirt':null;
      if(category){const volume=sourceVolumeBinding(p,proposal.costumeSourceVolume[direction]||{});if(volume.transform)material=`<g transform="${volume.transform}">${material}</g>`;}
      materials.set(p.id,material);
      if(p.id.startsWith('leg')){
        const side=p.parent.endsWith('Left')?'Left':'Right',segments=[];
        for(const [name,start,end] of layout.leg){
          let limb=await image(path.join(base,`generated/${direction}-${name}${side}-source.svg`));
          if(proposal.sourceOverlays?.[p.id]){
            assert.ok(!p.jointMasks,'Explicit leg joint masks need a dedicated source binding');
            const y=Math.max(0,start-layout.overlap),bottom=Math.min(288,end+layout.overlap);
            const source=svg(`<defs><clipPath id="joint"><rect x="0" y="${y}" width="192" height="${bottom-y}"/></clipPath></defs><g clip-path="url(#joint)">${material}</g>`);
            await fs.writeFile(path.join(out,`${direction}-${name}${side}-source.svg`),source);
            limb=embed(Buffer.from(source));
          }
          segments.push({id:name+side,side,kind:'leg',image:limb});
        }
        joints.set(p.id,segments);
      }
    }
  }
  let headStudy;
  if(proposal.headSourceOverlays?.[direction]){headStudy=await renderGuest01HeadSourceStudy(base,out,direction,proposal.headSourceOverlays[direction]);headSourceAudit.push({direction,overlays:headStudy.overlays});}
  const behind=await image(headStudy?.['behind-body']||path.join(base,`generated/head-${direction}-behind-body.svg`)),above=await image(headStudy?.['above-body']||path.join(base,`generated/head-${direction}-above-body.svg`));
  const neutral=await sharp(Buffer.from(svg(behind+parts.map(p=>materials.get(p.id)).join('')+above))).png().toBuffer();
  await fs.writeFile(path.join(out,`${direction}.png`),neutral);
  const frames=[];
  for(const [col,frame] of motion.frames.entries()){
    const layers=[behind],trace=new Map();
    for(const p of parts){
      if(joints.has(p.id))for(const j of joints.get(p.id)){
        const layer=`<g transform="translate(0 ${j.kind==='leg'?(frame.depth[j.side]||0):0}) ${transform(j.id,frame)}">${j.image}</g>`;
        layers.push(layer);trace.set(j.id,layer);
      }
      else{
        const [x,y]=cloth.pivot;
        const clothTransform=p.id.startsWith('skirt-')?` translate(${x} ${y}) rotate(${cloth.directions[direction][col]}) translate(${-x} ${-y})`:'';
        const layer=`<g transform="${transform(p.parent,frame)}${clothTransform}">${materials.get(p.id)}</g>`;
        layers.push(layer);trace.set(p.id,layer);
      }
    }
    layers.push(above);
    const alphas=new Map();
    for(const [id,layer] of trace)if(/^(torso-|neck-|upperArm|forearm|hand)/.test(id))alphas.set(id,await sharp(Buffer.from(svg(layer))).ensureAlpha().extractChannel(3).raw().toBuffer());
    for(const [a,b] of [[`neck-${direction}`,`torso-${direction}`],...['Left','Right'].flatMap(side=>[[`torso-${direction}`,`upperArm${side}`],[`upperArm${side}`,`forearm${side}`],[`forearm${side}`,`hand${side}`]])]){
      const connection=alphaConnection(alphas.get(a),alphas.get(b));connections.push({direction,frame:col+1,a,b,...connection});
    }
    const source=svg(layers.join('')),png=await sharp(Buffer.from(source)).png().toBuffer();
    const meta=await sharp(png).metadata();assert.equal(meta.width,192);assert.equal(meta.height,288);
    await fs.writeFile(path.join(out,`${direction}-walk-${col+1}.svg`),source);
    await fs.writeFile(path.join(out,`${direction}-walk-${col+1}.png`),png);
    frames.push(png);tiles.push({input:png,left:col*192,top:row*288});
  }
  assert.deepEqual(frames[1],frames[3]);assert.notDeepEqual(frames[0],frames[2]);
  if(direction==='front'&&variant==='balanced-arms-four-direction-v2')for(let i=0;i<4;i++)assert.deepEqual(frames[i],await fs.readFile(path.join(base,`review/balanced-arms-v2/front-walk-${i+1}.png`)),'Approved working front proposal must not drift');
  if(variant==='balanced-shading-v3')for(let i=0;i<4;i++)assert.deepEqual(await sharp(frames[i]).extractChannel(3).raw().toBuffer(),await sharp(path.join(base,`review/balanced-arms-four-direction-v2/${direction}-walk-${i+1}.png`)).extractChannel(3).raw().toBuffer(),'Approved silhouette must not drift');
  audit.push({direction,neutralIdentical:true,oppositeFramesDifferent:true,forward:motion.frames.map(f=>f.forward),frames:frames.map(hash)});
  comparison.push({direction,before:await fs.readFile(path.join(base,`generated/${direction}-body-study.png`)),after:neutral});
}
await fs.writeFile(path.join(out,'walk.png'),await packCharacterFrames(768,1152,tiles));
await sharp(path.join(out,'walk.png')).resize(384,576).png().toFile(path.join(out,'walk-runtime.png'));
const neutral=await fs.readFile(path.join(out,'front-walk-2.png'));
const idle=await packCharacterFrames(384,288,[{input:neutral,left:0,top:0},{input:neutral,left:192,top:0}]);
await fs.writeFile(path.join(out,'idle.png'),idle);
await sharp(idle).resize(192,144).png().toFile(path.join(out,'idle-runtime.png'));
await sharp(path.join(out,'walk.png')).resize(192,288).png().toFile(path.join(out,'walk-game.png'));
const contactSheet=`<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1152"><rect width="768" height="1152" fill="#d6dfca"/><image width="768" height="1152" href="data:image/png;base64,${(await fs.readFile(path.join(out,'walk.png'))).toString('base64')}"/></svg>`;
await sharp(Buffer.from(contactSheet)).png().toFile(path.join(out,'contact-sheet.png'));
const compare=`<svg xmlns="http://www.w3.org/2000/svg" width="768" height="640"><rect width="768" height="640" fill="#d6dfca"/>${comparison.map((v,i)=>`<text x="${i*192+8}" y="20" font-family="sans-serif" font-size="14">${v.direction}: BEFORE / AFTER</text>${['before','after'].map((k,j)=>`<image x="${i*192}" y="${32+j*300}" width="192" height="288" href="data:image/png;base64,${v[k].toString('base64')}"/>`).join('')}`).join('')}</svg>`;
await sharp(Buffer.from(compare)).png().toFile(path.join(out,'comparison.png'));
for(const [file,digest] of protectedHashes)assert.equal(hash(await fs.readFile(path.join(base,file))),digest,'Canonical asset mutated');
await fs.writeFile(path.join(out,'audit.json'),JSON.stringify({scope:'guest01 isolated four-direction source study',variant,sourceAudit,sourceOverlayAudit,headSourceAudit,directions:audit,connections,protectedHashes,runtimeEligible:false,visualApproved:false},null,2)+'\n');
assert.ok(connections.every(c=>c.connected),'Source joint discontinuity: inspect audit.json and correct source before proceeding');
await fs.copyFile(path.join(root,'scripts/templates/guest01-balanced-review.html'),path.join(out,'review.html'));
const receiptOutputs=[
 ...['walk.png','walk-runtime.png','walk-game.png','idle.png','idle-runtime.png','audit.json'].map(f=>path.join(out,f)),
 ...proposal.directions.flatMap(d=>[1,2,3,4].map(f=>path.join(out,`${d}-walk-${f}.png`)))
];
await finishPaintedRender(root,path.join(out,'source-render-receipt.json'),receipt,receiptOutputs);
if(canonical)await finishPaintedRender(root,path.join(out,'walk-render-receipt.json'),receipt,receiptOutputs);
console.log(`16 frames rendered; 8 independent source arms; neutral pairs identical; ${variant==='balanced-shading-v3'?'approved 16-frame silhouette unchanged':'front v2 unchanged'}; canonical assets unchanged.`);
