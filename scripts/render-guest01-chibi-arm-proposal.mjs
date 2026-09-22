// SOURCE-only isolated assembly. No finished-frame pixels enter the candidate.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {sourceVolumeBinding} from './lib/storybookSourceVolume.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/guest-01/storybook-source-v1');
const variant=process.argv[2]||'chibi-arms-v1';
assert.ok(['chibi-arms-v1','balanced-arms-v2'].includes(variant));
const out=path.join(base,'review',variant);
const proposal=JSON.parse(await fs.readFile(path.join(out,'registration.json')));
const rig=JSON.parse(await fs.readFile(path.join(base,'body-registration.json')));
const svgImage=bytes=>`<image width="192" height="288" href="data:image/svg+xml;base64,${bytes.toString('base64')}"/>`;
const layers=[svgImage(await fs.readFile(path.join(base,'generated/head-front-behind-body.svg')))];
const materials=new Map();
const sourceAudit=[];
for(const p of rig.parts.filter(p=>p.direction==='front').sort((a,b)=>(a.layer==='nearArm'?1:0)-(b.layer==='nearArm'?1:0))){
  const part=proposal.parts.find(a=>a.id===p.id);
  if(!part){
    const image=svgImage(await fs.readFile(path.join(base,`generated/${p.id}-registered.svg`)));
    const category=p.id.startsWith('torso-')?'torso':p.id.startsWith('skirt-')?'skirt':null;
    const volume=category?sourceVolumeBinding(p,proposal.costumeSourceVolume):{transform:''};
    const material=volume.transform?`<g transform="${volume.transform}">${image}</g>`:image;
    layers.push(material);materials.set(p.id,material);continue;
  }
  const bytes=await fs.readFile(path.join(base,part.source));
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.channels,4);
  for(const [x,y] of [part.sourcePivot,part.sourceEnd])assert.ok(data[(y*info.width+x)*4+3]>128,'Landmark outside source: '+p.id);
  const source=[part.sourceEnd[0]-part.sourcePivot[0],part.sourceEnd[1]-part.sourcePivot[1]];
  const target=[p.targetEnd[0]-p.pivot[0],p.targetEnd[1]-p.pivot[1]];
  const scale=Math.hypot(...target)/Math.hypot(...source);
  const angle=(Math.atan2(target[1],target[0])-Math.atan2(source[1],source[0]))*180/Math.PI;
  const sampleScale=Math.min(1,scale*rig.sourceSamplesPerOutputPixel);
  const sampled=await sharp(bytes).resize(Math.round(info.width*sampleScale),Math.round(info.height*sampleScale),{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
  const material=`<g transform="translate(${p.pivot}) rotate(${angle}) scale(${scale}) translate(${-part.sourcePivot[0]} ${-part.sourcePivot[1]})"><image width="${info.width}" height="${info.height}" href="data:image/png;base64,${sampled.toString('base64')}"/></g>`;
  layers.push(material);materials.set(p.id,material);
  sourceAudit.push({...part,pivot:p.pivot,targetEnd:p.targetEnd,scale,angle,sha256:createHash('sha256').update(bytes).digest('hex'),alphaPreserved:true,mirrored:false});
}
layers.push(svgImage(await fs.readFile(path.join(base,'generated/head-front-above-body.svg'))));
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${layers.join('')}</svg>`;
await fs.writeFile(path.join(out,'front.svg'),svg);
const png=await sharp(Buffer.from(svg)).png().toBuffer();await fs.writeFile(path.join(out,'front.png'),png);
const before=await fs.readFile(path.join(base,'generated/front-body-study.png'));
const reference=await fs.readFile(variant==='balanced-arms-v2'?path.join(base,'review/chibi-arms-v1/front.png'):path.join(root,'character-assets/rigs/guest-07/storybook-source-v1/generated/front-body-study.png'));
const imgs=variant==='balanced-arms-v2'?[before,reference,png]:[before,png,reference],labels=variant==='balanced-arms-v2'?['ORIGINAL','REJECTED: TOO PLUMP','BALANCED ARMS V2']:['BEFORE','ROUNDER SOURCE PROPOSAL','GUEST 07 REFERENCE'];
const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="800"><rect width="1152" height="800" fill="#d6dfca"/>${imgs.map((b,i)=>`<text x="${i*384+30}" y="28" font-family="sans-serif" font-size="18" fill="#304036">${labels[i]}</text><image x="${i*384}" y="40" width="384" height="576" href="data:image/png;base64,${b.toString('base64')}"/><image x="${i*384+96}" y="630" width="96" height="144" href="data:image/png;base64,${b.toString('base64')}"/><image x="${i*384+220}" y="665" width="48" height="72" href="data:image/png;base64,${b.toString('base64')}"/>`).join('')}</svg>`;
await sharp(Buffer.from(sheet)).png().toFile(path.join(out,'comparison.png'));
// Use the existing shared dress motion and authored joint masks, not a newly
// generated walk pose. This review remains isolated from the runtime adapter.
const common=path.resolve(base,'../../common-three-head-216-v1');
const skeleton=JSON.parse(await fs.readFile(path.join(common,'skeleton.json'))),bones=skeleton.bones;
const motion=JSON.parse(await fs.readFile(path.join(common,'animations/dress-front.json')));
const contact=JSON.parse(await fs.readFile(path.join(common,rig.contactAnimation)));
const cloth=JSON.parse(await fs.readFile(path.join(common,rig.clothAnimation)));
for(const [i,depth] of Object.entries(contact.directions.front||{}))Object.assign(motion.frames[i].depth,depth);
const transform=(id,frame)=>{const ids=[];for(let b=id;b;b=bones[b].parent)ids.unshift(b);return ids.map(b=>{const [x,y]=bones[b].pivot;return `translate(${x} ${y}) rotate(${frame.rotations[b]||0}) translate(${-x} ${-y})`;}).join(' ');};
const parts=rig.parts.filter(p=>p.direction==='front').sort((a,b)=>(a.layer==='nearArm'?1:0)-(b.layer==='nearArm'?1:0));
const frames=[];
for(const [index,frame] of motion.frames.entries()){
  const ls=[svgImage(await fs.readFile(path.join(base,'generated/head-front-behind-body.svg')))];
  for(const p of parts){
    const side=p.parent.endsWith('Left')?'Left':'Right';
    if(p.id.startsWith('arm')){
      for(const name of ['upperArm','forearm','hand']){
        const mask=svgImage(await fs.readFile(path.join(base,p.jointMasks[name])));
        const joint=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><defs><mask id="joint" maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="288">${mask}</mask></defs><g mask="url(#joint)">${materials.get(p.id)}</g></svg>`);
        ls.push(`<g transform="${transform(name+side,frame)}">${svgImage(joint)}</g>`);
      }
    }else if(p.id.startsWith('leg')){
      for(const name of ['thigh','calf','shoe'])ls.push(`<g transform="translate(0 ${frame.depth[side]||0}) ${transform(name+side,frame)}">${svgImage(await fs.readFile(path.join(base,`generated/front-${name+side}-source.svg`)))}</g>`);
    }else{
      const [x,y]=cloth.pivot;
      const t=p.id.startsWith('skirt-')?` translate(${x} ${y}) rotate(${cloth.directions.front[index]}) translate(${-x} ${-y})`:'';
      ls.push(`<g transform="${transform(p.parent,frame)}${t}">${materials.get(p.id)}</g>`);
    }
  }
  ls.push(svgImage(await fs.readFile(path.join(base,'generated/head-front-above-body.svg'))));
  const frameSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${ls.join('')}</svg>`;
  const png=await sharp(Buffer.from(frameSvg)).png().toBuffer();frames.push(png);
  await fs.writeFile(path.join(out,`front-walk-${index+1}.svg`),frameSvg);
  await fs.writeFile(path.join(out,`front-walk-${index+1}.png`),png);
}
assert.deepEqual(frames[1],frames[3]);assert.notDeepEqual(frames[0],frames[2]);
for(const frame of frames){const meta=await sharp(frame).metadata();assert.equal(meta.width,192);assert.equal(meta.height,288);}
await fs.writeFile(path.join(out,'source-audit.json'),JSON.stringify({scope:'front neutral and four walk frames only',frame:[192,288],sourceAudit,checks:{neutralFramesIdentical:true,oppositeFramesDifferent:true,frameDimensions:true},runtimeEligible:false,visualApproved:false},null,2)+'\n');
await sharp({create:{width:768,height:288,channels:4,background:'#00000000'}}).composite(frames.map((input,i)=>({input,left:192*i,top:0}))).png().toFile(path.join(out,'front-walk.png'));
await fs.writeFile(path.join(out,'review.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>1번 둥근 팔 원화 검토</title><style>body{margin:20px;font:16px system-ui;background:#e4e9dc;color:#28352c}button{font:inherit;padding:10px}main{display:flex;gap:24px;align-items:end}.sprite{background-image:url(front-walk.png);background-size:400% 100%;background-position:33.333% 0}.selection{width:96px;height:144px}.game{width:48px;height:72px}img{max-width:100%;height:auto}</style><h1>1번 정면 원화 검토</h1><p>새 양팔 + 몸통·치마 원본 배치. 머리·골격 유지. 다른 방향/운영 미적용.</p><button id="play">보행 재생</button><main><section><p>96×144</p><div class="sprite selection"></div></section><section><p>48×72</p><div class="sprite game"></div></section></main><p id="frame">중립 2번</p><img src="comparison.png" alt="이전, 새 원화 조립, 7번 기준 비교"><script>let active=false,i=1;const b=document.querySelector('#play'),s=[...document.querySelectorAll('.sprite')];function draw(){s.forEach(e=>e.style.backgroundPosition=(i/3*100)+'% 0');document.querySelector('#frame').textContent=(i+1)+'번 프레임';}b.onclick=()=>{active=!active;b.textContent=active?'정지':'보행 재생';if(!active){i=1;draw();}};setInterval(()=>{if(active){i=(i+1)%4;draw();}},180);</script></html>`);
if(variant==='balanced-arms-v2'){
  const file=path.join(out,'review.html');
  const html=await fs.readFile(file,'utf8');
  await fs.writeFile(file,html.replace('1번 둥근 팔 원화 검토','1번 자연스러운 팔 수정본').replace('1번 정면 원화 검토','1번 팔 형태 수정 v2').replace('새 양팔 + 몸통·치마 원본 배치. 머리·골격 유지. 다른 방향/운영 미적용.','과장된 소매·아래팔 볼륨 축소. 머리·골격·몸통은 이전 후보 유지. 정면만 수정, 운영 미적용.').replace('이전, 새 원화 조립, 7번 기준 비교','원래 팔, 통통했던 후보, 이번 수정본 비교'));
}
console.log('Front proposal only. Original source alpha retained; skeleton targets unchanged.');
