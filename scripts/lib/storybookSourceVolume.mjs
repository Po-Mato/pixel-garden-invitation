import assert from 'node:assert/strict';
// Artist-authored source binding before joint separation and animation.
// Fixed attachment axis and all y coordinates are preserved.
export function sourceVolumeBinding(part, profile) {
  const category=part.id.startsWith('torso-')?'torso':part.id.startsWith('skirt-')?'skirt':part.id.startsWith('arm')?'arm':part.id.startsWith('leg')?'leg':null;
  const width=category?(part.sourceWidth??profile?.[category]??1):1;
  assert.ok(Number.isFinite(width)&&width>0&&width<=2,'Invalid authored source width');
  if(width===1)return {width,transform:''};
  const [x,y]=part.pivot;
  const slope=part.targetEnd?(part.targetEnd[0]-x)/(part.targetEnd[1]-y):0;
  assert.ok(Number.isFinite(slope),'Source volume requires a nonhorizontal limb axis');
  const shear=(1-width)*slope;
  return {width,axis:[x,y,slope],transform:`translate(${x} ${y}) matrix(${width} 0 ${shear} 1 0 0) translate(${-x} ${-y})`};
}
