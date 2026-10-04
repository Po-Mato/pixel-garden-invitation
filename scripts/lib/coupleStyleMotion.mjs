import assert from 'node:assert/strict';
import sharp from './deterministicSharp.mjs';

const WIDTH = 192;
const HEIGHT = 288;
const DIRECTIONS = new Set(['front', 'left', 'right', 'back']);
const TEMPLATES = new Set(['dress', 'skirt', 'femaleHanbok', 'tailored', 'maleHanbok']);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

function bounds(raw) {
  let left = WIDTH, top = HEIGHT, right = -1, bottom = -1;
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if (raw[(y * WIDTH + x) * 4 + 3] < 128) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return {left, top, right, bottom, center: (left + right) / 2};
}

// A nearest-sampled thin gap can close despite a continuous mesh. Count meaningful
// enclosed transparency so an unsafe arm pose can fall back to the untouched arm.
function interiorHoles(raw) {
  const seen = new Uint8Array(WIDTH * HEIGHT); let count = 0;
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || raw[start * 4 + 3] >= 128) continue;
    const pending = [start]; seen[start] = 1; let size = 0, edge = false;
    while (pending.length) {
      const at = pending.pop(), x = at % WIDTH, y = Math.floor(at / WIDTH); size++;
      if (!x || x === WIDTH - 1 || !y || y === HEIGHT - 1) edge = true;
      for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const X=x+dx,Y=y+dy,next=Y*WIDTH+X;
        if(X<0||X>=WIDTH||Y<0||Y>=HEIGHT||seen[next]||raw[next*4+3]>=128)continue;
        seen[next]=1;pending.push(next);
      }
    }
    if (!edge && size > 3) count++;
  }
  return count;
}

/**
 * Conservative motion for a flattened, already approved neutral drawing.
 * Every output RGBA pixel is copied from this drawing using nearest sampling.
 * No hidden limbs, skin, garment fill, mirroring, or new painted pixels exist.
 * Long garments stay still; only visible material below y=250 moves at the feet.
 */
export async function renderStyleWalk(neutral, {direction, template}) {
  assert.ok(DIRECTIONS.has(direction), 'Unknown direction');
  assert.ok(TEMPLATES.has(template), 'Unknown costume template');
  const {data: source, info} = await sharp(neutral).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  assert.deepEqual([info.width, info.height, info.channels], [WIDTH, HEIGHT, 4], 'Neutral must be 192x288 RGBA');
  const original = bounds(source);
  assert.equal(original.top, 54, 'Neutral head top must be 54');
  assert.equal(original.bottom, 269, 'Neutral foot baseline must be 270');
  assert.ok(original.left > 4 && original.right < WIDTH - 5, 'Neutral requires a motion safety margin');

  // Use the actual visible soles to register the split, not the hair silhouette.
  let footLeft = WIDTH, footRight = -1;
  for (let y = 260; y <= 269; y++) for (let x = 0; x < WIDTH; x++) {
    if (source[(y * WIDTH + x) * 4 + 3] >= 128) {
      footLeft = Math.min(footLeft, x); footRight = Math.max(footRight, x);
    }
  }
  const center = (footLeft + footRight) / 2;
  const footStart = template === 'tailored' ? 236 : 250;
  const sideView = direction === 'left' || direction === 'right';
  const travel = direction === 'left' ? -1 : 1;
  const phases = [-1, 0, 1, 0];
  const raws = [], frames = [], records = [];
  const sourceHoles = interiorHoles(source);
  const solePixels = side => { let count=0; for(let x=0;x<WIDTH;x++) if((side<0?x<center-3:x>center+3)&&source[(269*WIDTH+x)*4+3]>=128)count++; return count; };
  const footLift = direction === 'front' && template === 'tailored' && solePixels(-1)>=3 && solePixels(1)>=3 ? 2 : 0;
  let armScale = 1;
  function verticalDisplacement(x, y, phase) {
    if (!footLift || !phase || y < 245) return 0;
    const selectedSide = smooth((phase * (x - center) - 2) / 6);
    return -footLift * selectedSide * smooth((y - 245) / 24);
  }

  function displacement(x, y, phase) {
    if (y < 145 || !phase) return 0;
    // A continuous field across all regions prevents open cutout seams.
    // The outer arms move by at most 1.5 source pixels; the torso stays fixed.
    const armBand = smooth((y - 145) / 22) * (1 - smooth((y - 192) / 24));
    const outer = smooth((Math.abs(x - center) - 17) / 15);
    const arm = armScale * phase * 1.5 * armBand * outer;
    const footWeight = smooth((y - footStart) / (269 - footStart));
    const split = clamp((x - center) / 6, -1, 1);
    const foot = phase * (sideView ? travel : 1) * 3 * footWeight * split;
    return arm + foot;
  }

  function deform(phase) {
    const raw = Buffer.alloc(source.length); let changedPixels = 0, maxSourceDisplacement = 0;
    for (let y=0;y<HEIGHT;y++) for (let x=0;x<WIDTH;x++) {
      const destination=(y*WIDTH+x)*4;
      if(y<145){source.copy(raw,destination,destination,destination+4);continue;}
      let sx=x,sy=y;
      // Alternating inverse solves converge because both small displacement
      // fields have positive Jacobians and disjoint fixed/foot transition bands.
      for(let pass=0;pass<3;pass++) {
        let low=y-3,high=y+3;
        for(let i=0;i<14;i++){const middle=(low+high)/2;if(middle+verticalDisplacement(sx,middle,phase)<y)low=middle;else high=middle;}
        sy=(low+high)/2;low=x-4;high=x+4;
        for(let i=0;i<16;i++){const middle=(low+high)/2;if(middle+displacement(middle,sy,phase)<x)low=middle;else high=middle;}
        sx=(low+high)/2;
      }
      const X=Math.round(sx),Y=Math.round(sy);
      maxSourceDisplacement=Math.max(maxSourceDisplacement,Math.abs(X-x),Math.abs(Y-y));
      if(X>=0&&X<WIDTH&&Y>=0&&Y<HEIGHT)source.copy(raw,destination,(Y*WIDTH+X)*4,(Y*WIDTH+X)*4+4);
      if(!raw.subarray(destination,destination+4).equals(source.subarray(destination,destination+4)))changedPixels++;
    }
    return {raw,changedPixels,maxSourceDisplacement};
  }
  let moving = [deform(-1),deform(1)];
  if(moving.some(({raw})=>interiorHoles(raw)>sourceHoles)) {
    armScale=0;
    moving=[deform(-1),deform(1)];
  }
  for (const [index, phase] of phases.entries()) {
    if (!phase) {
      frames.push(neutral); raws.push(source);
      records.push({index, phase, bounds: original, copiedNeutralExactly: true, changedPixels: 0, maxSourceDisplacement: 0});
      continue;
    }
    const {raw,changedPixels,maxSourceDisplacement}=moving[phase<0?0:1];
    const frameBounds = bounds(raw);
    assert.ok(interiorHoles(raw) <= sourceHoles, 'Motion must not create or split enclosed transparent gaps');
    assert.deepEqual(raw.subarray(0, WIDTH * 145 * 4), source.subarray(0, WIDTH * 145 * 4), 'Head, neck and shoulders must remain exact');
    assert.equal(frameBounds.top, 54);
    assert.equal(frameBounds.bottom, 269);
    assert.ok(frameBounds.left > 0 && frameBounds.right < WIDTH - 1, 'Motion must not clip the canvas');
    assert.ok(Math.abs(frameBounds.center - original.center) <= 4, 'World-space center drift must be <=1px');
    assert.ok(changedPixels > 0, 'Neutral has no visible movable pixels');
    raws.push(raw);
    frames.push(await sharp(raw, {raw: {width: WIDTH, height: HEIGHT, channels: 4}}).png().toBuffer());
    records.push({index, phase, bounds: frameBounds, copiedNeutralExactly: false, changedPixels, maxSourceDisplacement});
  }
  assert.notDeepEqual(raws[0], raws[2], 'Opposing walking phases must differ');
  const centerDrift = Math.max(...records.map(r => r.bounds.center)) - Math.min(...records.map(r => r.bounds.center));
  assert.ok(centerDrift <= 4, 'Peak-to-peak center drift must be <=1 world pixel');
  return {frames, audit: {
    renderer: 'couple-style-inverse-nearest-v2', direction, template,
    canvas: [WIDTH, HEIGHT], phases, fixedRows: [0, 144], footStart,
    footBaseline: 270, footLiftPixels: footLift, maxArmDisplacement: 1.5 * armScale,
    armTopologyFallback: armScale === 0, sourceInteriorHoles: sourceHoles,
    maxFootDisplacement: 3, centerDriftWorldPixels: centerDrift / 4,
    sampling: 'nearest inverse mapping', sourcePixelsOnly: true,
    limitation: 'Restrained visible-surface motion; does not reconstruct occluded anatomy. Alternating lift is limited to front tailored art with two grounded visible soles.',
    frames: records
  }};
}
