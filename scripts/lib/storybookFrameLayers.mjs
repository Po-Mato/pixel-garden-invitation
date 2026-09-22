import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';

// Generated SVGs contain only nested SVG elements and base64 resources. Keep
// their exact transform/clip/mask strings; never reconstruct animation poses.
export function splitSvgChildren(svg) {
  assert.match(svg, /^<svg\b[^>]*>[\s\S]*<\/svg>$/);
  const body=svg.slice(svg.indexOf('>')+1,svg.lastIndexOf('</svg>'));
  const children=[];let depth=0,start=-1;
  for(const tag of body.matchAll(/<[^>]+>/g)){
    assert.ok(!/^<[!?]/.test(tag[0]),'Unsupported generated SVG markup');
    const closing=tag[0].startsWith('</'),selfClosing=tag[0].endsWith('/>');
    if(!closing&&depth===0)start=tag.index;
    if(closing)depth--;else if(!selfClosing)depth++;
    assert.ok(depth>=0);
    if(depth===0){children.push(body.slice(start,tag.index+tag[0].length));start=-1;}
  }
  assert.equal(depth,0);
  return children;
}

export async function readStorybookFrameLayers(base,direction,frameNumber) {
  assert.ok(['front','left','right','back'].includes(direction));
  assert.ok(Number.isInteger(frameNumber)&&frameNumber>=1&&frameNumber<=4);
  if(path.basename(base)==='storybook-directions-v1'&&path.basename(path.dirname(base))==='guest-05')return readAnchorFrameLayers(base,direction,frameNumber);
  const out=path.join(base,'generated');
  const json=async file=>JSON.parse(await fs.readFile(path.join(base,file)));
  const rig=await json('body-registration.json'),head=await json('head-registration.json');
  const bindings=(await json(`generated/${direction}-joint-bindings.json`)).parts;
  const layers=[];
  if(head.splitBodyOcclusion)layers.push({id:'head-behind-body',source:`head-${direction}-behind-body.svg`});
  for(const part of rig.parts.filter(p=>p.direction===direction).sort((a,b)=>(a.layer==='nearArm'?1:0)-(b.layer==='nearArm'?1:0))){
    const joints=bindings.filter(j=>j.source===part.id);
    if(joints.length)for(const joint of joints)layers.push({id:joint.id,sourcePart:part.id,source:`${direction}-${joint.id}-source.svg`});
    else layers.push({id:part.id,sourcePart:part.id,source:`${part.id}-registered.svg`});
  }
  layers.push({id:'head-above-body',source:head.splitBodyOcclusion?`head-${direction}-above-body.svg`:`head-${direction}-registered.svg`});
  return validateFrameLayers(out,direction,frameNumber,layers);
}

async function readAnchorFrameLayers(base,direction,frameNumber) {
  const front=direction==='front';
  const sourceBase=front?path.resolve(base,'../storybook-body-v1'):base;
  const out=path.join(sourceBase,'generated');
  const rig=JSON.parse(await fs.readFile(path.join(sourceBase,front?'front-registration.json':'body-registration.json')));
  const layers=[{id:'shadow',source:path.resolve(sourceBase,rig.shadow.source)}];
  if(front){
    for(const side of ['Right','Left'])for(const id of ['thigh','calf','shoe'])layers.push({id:id+side,source:`joint-parts/${id+side}.svg`});
    layers.push({id:'neck-front',source:path.join(sourceBase,'neck-front.svg')},{id:'skirt-front',source:'skirt-registered.svg'},{id:'bag-front',source:'bag-registered.svg'});
    for(const side of ['Right','Left'])for(const id of ['upperArm','forearm','hand'])layers.push({id:id+side,source:`joint-parts/${id+side}.svg`});
    layers.push({id:'torso-front',source:'torso-registered.svg'},{id:'head-above-body',source:'head-registered.svg'});
  }else{
    layers.push({id:`neck-${direction}`,source:path.join(sourceBase,'neck-skin.svg')});
    const parts=rig.parts.filter(p=>p.direction===direction);
    const bindings=JSON.parse(await fs.readFile(path.join(out,`${direction}-joint-bindings.json`))).parts;
    for(const part of [...parts.filter(p=>p.layer!=='nearArm'),...parts.filter(p=>p.layer==='nearArm')]){
      const joints=bindings.filter(j=>j.source===part.id);
      if(joints.length)for(const joint of joints)layers.push({id:joint.id,sourcePart:part.id,source:`${direction}-${joint.id}-source.svg`});
      else layers.push({id:part.id,sourcePart:part.id,source:`${part.id}-registered.svg`});
    }
    layers.push({id:'head-above-body',source:`head-${direction}-registered.svg`});
  }
  return validateFrameLayers(out,direction,frameNumber,layers);
}

async function validateFrameLayers(out,direction,frameNumber,layers) {
  const svg=await fs.readFile(path.join(out,`${direction}-walk-${frameNumber}.svg`),'utf8');
  const children=splitSvgChildren(svg),defs=children.filter(c=>c.startsWith('<defs>')).join('');
  const drawable=children.filter(c=>!c.startsWith('<defs>'));
  assert.equal(drawable.length,layers.length,'Layer mapping must cover the actual frame exactly');
  const wrap=content=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288">${defs}${content}</svg>`);
  const recomposed=await sharp(wrap(drawable.join(''))).ensureAlpha().raw().toBuffer();
  const expected=await sharp(path.join(out,`${direction}-walk-${frameNumber}.png`)).ensureAlpha().raw().toBuffer();
  assert.deepEqual(recomposed,expected,'Diagnostic decomposition must preserve the exact rendered frame');
  for(let i=0;i<layers.length;i++){
    const embedded=(await fs.readFile(path.resolve(out,layers[i].source))).toString('base64');
    assert.ok(drawable[i].includes(embedded),`Unverified source mapping: ${layers[i].id}`);
  }
  return {layers,drawable,wrap,expected};
}

export async function inspectStorybookFrameLayers(base,direction,frameNumber,points) {
  for(const p of points)assert.ok(p.length===2&&p.every(Number.isInteger)&&p[0]>=0&&p[0]<48&&p[1]>=0&&p[1]<72);
  const {layers,drawable,wrap,expected}=await readStorybookFrameLayers(base,direction,frameNumber);
  const alphas=[];
  for(let i=0;i<layers.length;i++){
    const high=await sharp(wrap(drawable[i])).png().toBuffer();
    const half=await sharp(high).resize(96,144).png().toBuffer();
    alphas.push(await sharp(half).resize(48,72).ensureAlpha().extractChannel(3).raw().toBuffer());
  }
  const ownership=points.map(([x,y])=>{
    let transmission=1;const contributors=[];
    for(let i=layers.length-1;i>=0;i--){
      const alpha=alphas[i][y*48+x]/255,visible=alpha*transmission;
      if(visible>0)contributors.push({id:layers[i].id,sourcePart:layers[i].sourcePart??null,visibleAlpha:visible});
      transmission*=1-alpha;
    }
    contributors.sort((a,b)=>b.visibleAlpha-a.visibleAlpha);
    return {x,y,dominant:contributors[0]?.id??null,contributors};
  });
  return {direction,frameNumber,sourceFrameRgbaSha256:createHash('sha256').update(expected).digest('hex'),exactFrameReconstruction:true,display:[48,72],
    limitation:'Part attribution uses two-stage Sharp resampling, not browser color/contrast measurement. Mixed antialiased edges remain approximate; this grants no visual acceptance.',ownership};
}
