import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from './lib/deterministicSharp.mjs';
import {renderStyleWalk} from './lib/coupleStyleMotion.mjs';

async function fixture() {
  const raw = Buffer.alloc(192 * 288 * 4);
  // Synthetic test data only: broad body, separated soles, textured arms.
  const fill = (x0,y0,x1,y1) => {for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const i=(y*192+x)*4;raw[i]=x;raw[i+1]=y%256;raw[i+2]=(x+y)%256;raw[i+3]=255;
  }};
  fill(64,54,126,125);fill(87,126,104,145);fill(68,145,123,249);
  fill(55,147,67,205);fill(124,147,136,205);
  fill(74,250,88,269);fill(106,250,120,269);
  return {raw,png:await sharp(raw,{raw:{width:192,height:288,channels:4}}).png().toBuffer()};
}
const pixels = b => sharp(b).ensureAlpha().raw().toBuffer();

test('all templates and directions preserve fixed art, neutral files, ground and source colors',async()=>{
  const {raw,png}=await fixture();
  const colors=new Set();for(let i=0;i<raw.length;i+=4)colors.add(raw.readUInt32LE(i));
  for(const template of ['dress','skirt','femaleHanbok','tailored','maleHanbok'])for(const direction of ['front','left','right','back']){
    const {frames,audit}=await renderStyleWalk(png,{direction,template});
    assert.equal(frames.length,4);assert.strictEqual(frames[1],png);assert.strictEqual(frames[3],png);
    const output=await Promise.all(frames.map(pixels));
    assert.notDeepEqual(output[0],output[2]);
    for(const image of output){
      assert.deepEqual(image.subarray(0,192*145*4),raw.subarray(0,192*145*4));
      for(let i=0;i<image.length;i+=4)assert.ok(colors.has(image.readUInt32LE(i)),'No invented color or interpolated alpha');
      for(let y=0;y<288;y++){assert.equal(image[(y*192)*4+3],0);assert.equal(image[(y*192+191)*4+3],0);}
      // No artificial transparent holes through the continuous torso.
      for(let y=145;y<245;y++)for(let x=72;x<120;x++)assert.equal(image[(y*192+x)*4+3],255);
    }
    assert.ok(audit.centerDriftWorldPixels<=1);
    for(const f of audit.frames){assert.equal(f.bounds.top,54);assert.equal(f.bounds.bottom,269);assert.ok(f.maxSourceDisplacement<=3);}
    if(template!=='tailored')for(const index of [0,2])for(let y=216;y<250;y++)assert.deepEqual(output[index].subarray(y*192*4,(y+1)*192*4),raw.subarray(y*192*4,(y+1)*192*4),'Long hem remains exact');
  }
});

test('left and right profiles apply opposite signed travel to the same visible material',async()=>{
  const {png}=await fixture();
  const left=await renderStyleWalk(png,{direction:'left',template:'tailored'});
  const right=await renderStyleWalk(png,{direction:'right',template:'tailored'});
  const a=await pixels(left.frames[0]),b=await pixels(right.frames[2]);
  assert.deepEqual(a.subarray(236*192*4),b.subarray(236*192*4));
});

test('rejects wrong geometry and unsupported costumes instead of silently rescaling',async()=>{
  const {png}=await fixture();
  await assert.rejects(renderStyleWalk(png,{direction:'front',template:'unknown'}),/costume/);
  const small=await sharp(png).resize(96,144).png().toBuffer();
  await assert.rejects(renderStyleWalk(small,{direction:'front',template:'dress'}),/192x288/);
});


test('front tailored lift alternates only when both source soles are grounded',async()=>{
  const {png,raw}=await fixture();
  const result=await renderStyleWalk(png,{direction:'front',template:'tailored'});
  assert.equal(result.audit.footLiftPixels,2);
  const left=await pixels(result.frames[0]),right=await pixels(result.frames[2]);
  const soleCount=(image,x0,x1)=>{let n=0;for(let x=x0;x<x1;x++)if(image[(269*192+x)*4+3]>=128)n++;return n;};
  assert.equal(soleCount(left,0,96),0);assert.ok(soleCount(left,96,192)>0);
  assert.ok(soleCount(right,0,96)>0);assert.equal(soleCount(right,96,192),0);
  const single=Buffer.from(raw);for(let x=96;x<192;x++)single[(269*192+x)*4+3]=0;
  const oneGrounded=await sharp(single,{raw:{width:192,height:288,channels:4}}).png().toBuffer();
  const unchanged=await renderStyleWalk(oneGrounded,{direction:'front',template:'tailored'});
  assert.equal(unchanged.audit.footLiftPixels,0,'No invented second support foot');
});
