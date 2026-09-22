import assert from 'node:assert/strict';

// Sanity gate for centered SOURCE-part canvases, not a visual-quality score.
// A failed outline trace must not silently export an almost empty costume.
export function assertSourceMatteCoverage(alpha,width,height,label){
  assert.ok(Number.isInteger(width)&&width>0&&Number.isInteger(height)&&height>0);
  assert.equal(alpha.length,width*height,`${label}: matte channel dimensions`);
  let opaque=0;for(const a of alpha)if(a>=128)opaque++;
  assert.ok(opaque>=Math.max(16,width*height*0.01),`${label}: source matte is almost empty (${opaque} pixels); review the editable silhouette, do not repair output frames`);
}
