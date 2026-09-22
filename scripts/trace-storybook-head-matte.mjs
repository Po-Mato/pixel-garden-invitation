// One-time source-matte drafting aid. Emits an editable SVG, never modifies artwork.
import sharp from 'sharp';
const source = process.argv[2] || 'character-assets/rigs/guest-05/storybook-head-study-v1/front-head-candidate.png';
const { data, info } = await sharp(source).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height;
// Opt-in drafting for an individually reviewed opaque source with a CLOSED
// dark ink outline. Flood the exterior, not white/cream pixels: enclosed white
// cuffs and highlights remain inside the source silhouette. Never used at render
// time or on a finished animation frame. Inspect the emitted SVG before use.
// Explicit mixed mode is for a reviewed source whose exterior contains both
// opaque painted checker cells and actual alpha. Alpha holes are exterior,
// never dark ink walls. The opaque-only mode keeps its original guard.
const mixedOutline = process.argv.includes('--mixed-outline');
// Individually selected drafting mode for warm-brown line art over achromatic
// painted checker. It identifies the SOURCE ink boundary, never keys out cream.
const warmOutline = process.argv.includes('--warm-outline');
// Opt-in source drafting for dark navy sleeves joined to warm skin. Both ink
// families must close the contour; neither achromatic checker nor pale belt is
// treated as an outline. This does not change any render/acceptance threshold.
const darkWarmOutline = process.argv.includes('--dark-warm-outline');
const closedOutline = process.argv.includes('--closed-outline') || mixedOutline || warmOutline || darkWarmOutline;
if (closedOutline) {
  if (!mixedOutline && data.some(a => a < 250)) throw Error('Closed-outline drafting requires an opaque source; use its alpha otherwise.');
  const rgb = await sharp(source).removeAlpha().raw().toBuffer();
  const wall = new Uint8Array(w*h), exterior = new Uint8Array(w*h), queue = [];
  // Colored brown ink around skin is also an outline, unlike pale checker cells.
  for (let i=0;i<wall.length;i++) {
    const r=rgb[i*3],g=rgb[i*3+1],b=rgb[i*3+2],luma=.2126*r+.7152*g+.0722*b;
    const warmInk=r-b>=12&&r-g>=4&&luma<220;
    const ink=darkWarmOutline?(luma<100||warmInk):warmOutline?warmInk:luma<100;
    wall[i]=data[i]>=250&&ink?1:0;
  }
  const seed = p => {if (!wall[p] && !exterior[p]) {exterior[p]=1;queue.push(p);}};
  for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x);}
  for(let y=0;y<h;y++){seed(y*w);seed(y*w+w-1);}
  for(let j=0;j<queue.length;j++){
    const p=queue[j],x=p%w,y=Math.floor(p/w);
    for(const q of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(q>=0)seed(q);
  }
  for(let i=0;i<data.length;i++)data[i]=exterior[i]?0:255;
  // One source-resolution pixel inside the ink boundary avoids including the
  // antialiased checker/white fringe. At this source's registration scale this
  // is under 0.04 output pixel, not a body proportion adjustment.
  const coverage=Uint8Array.from(data);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=y*w+x;
    if(!x||!y||x===w-1||y===h-1||!coverage[p-1]||!coverage[p+1]||!coverage[p-w]||!coverage[p+w])data[p]=0;
  }
}
const visited = new Uint8Array(w * h);
let largest = [];
for (let i = 0; i < data.length; i++) {
  if (visited[i] || data[i] < 240) continue;
  const component = [i]; visited[i] = 1;
  for (let j = 0; j < component.length; j++) {
    const p = component[j], x = p % w, y = Math.floor(p / w);
    for (const q of [x ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y ? p - w : -1, y < h - 1 ? p + w : -1]) {
      if (q >= 0 && !visited[q] && data[q] >= 240) { visited[q] = 1; component.push(q); }
    }
  }
  if (component.length > largest.length) largest = component;
}
const filled = new Uint8Array(w * h); for (const p of largest) filled[p] = 1;
const edges = new Map(), stride = w + 1;
const edge = (x, y, xx, yy) => { const k = y * stride + x; if (!edges.has(k)) edges.set(k, []); edges.get(k).push(yy * stride + xx); };
for (const p of largest) {
  const x = p % w, y = Math.floor(p / w);
  if (!y || !filled[p - w]) edge(x, y, x + 1, y);
  if (x === w - 1 || !filled[p + 1]) edge(x + 1, y, x + 1, y + 1);
  if (y === h - 1 || !filled[p + w]) edge(x + 1, y + 1, x, y + 1);
  if (!x || !filled[p - 1]) edge(x, y + 1, x, y);
}
function simplify(points, tolerance = 0.7) {
  if (points.length < 3) return points;
  const a = points[0], b = points.at(-1), dx = b[0] - a[0], dy = b[1] - a[1];
  let max = 0, at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    if (d > max) { max = d; at = i; }
  }
  return max > tolerance ? [...simplify(points.slice(0, at + 1)).slice(0, -1), ...simplify(points.slice(at))] : [a, b];
}
const paths = [];
while (edges.size) {
  const start = edges.keys().next().value, loop = []; let p = start;
  do {
    loop.push([p % stride, Math.floor(p / stride)]);
    const list = edges.get(p); if (!list?.length) throw Error('Open contour');
    const next = list.pop(); if (!list.length) edges.delete(p); p = next;
  } while (p !== start);
  // Preserve visible holes, omit only subpixel-scale isolated contour loops in the tracing draft.
  if (loop.length < 8) continue;
  loop.push(loop[0]);
  const points = simplify(loop);
  paths.push(`M ${points.map(p => p.join(' ')).join(' L ')} Z`);
}
console.log(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n<!-- Source silhouette draft: ${closedOutline?'exterior flood bounded by closed ink outline; enclosed white cloth preserved':'main opaque alpha component'}. Editable independently; renderer never retraces. -->\n<path fill="white" fill-rule="evenodd" d="${paths.join(' ')}"/>\n</svg>`);
