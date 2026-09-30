import assert from 'node:assert/strict';
export const limbNames=['upperArmLeft','forearmLeft','handLeft','upperArmRight','forearmRight','handRight','thighLeft','calfLeft','shoeLeft','thighRight','calfRight','shoeRight'];
export function canonicalBones(shared,direction){
 const authored=shared.directions[direction];assert.ok(authored);
 return {root:{parent:null,pivot:shared.root},spine:{parent:'root',pivot:authored.jacket.pivot},pelvis:authored.pelvis,neck:authored.neck,head:{parent:'neck',pivot:[96,126]},...Object.fromEntries(limbNames.map(id=>[id,authored[id]]))};
}
function end(bones,id){
 const next=id.replace(/^upperArm/,'forearm').replace(/^forearm/,'hand');
 // Avoid replacing upperArm twice: explicit chain endpoints, not image bounds.
 if(id.startsWith('upperArm'))return bones[id.replace('upperArm','forearm')].pivot;
 if(id.startsWith('forearm'))return bones[next].pivot;
 if(id.startsWith('thigh'))return bones[id.replace('thigh','calf')].pivot;
 if(id.startsWith('calf'))return bones[id.replace('calf','shoe')].pivot;
 const p=bones[id].pivot;return [p[0],id.startsWith('shoe')?270:p[1]+12];
}
// Bind the original painted part to a fixed bone. Preserve perpendicular thickness;
// only the longitudinal registration follows canonical bone length. No frame PNGs.
export function boneRegistration(source,target,id){
 const p=source[id].pivot,q=end(source,id),P=target[id].pivot,Q=end(target,id);
 return {...segmentRegistration(p,q,P,Q),parent:target[id].parent};
}
export function segmentRegistration(p,q,P,Q){
 const u=[q[0]-p[0],q[1]-p[1]],v=[Q[0]-P[0],Q[1]-P[1]];
 const l=Math.hypot(...u),L=Math.hypot(...v);assert.ok(l>0&&L>0);
 const a=u.map(n=>n/l),b=v.map(n=>n/L),n=[-a[1],a[0]],N=[-b[1],b[0]],k=L/l;
 const m=[b[0]*k*a[0]+N[0]*n[0],b[1]*k*a[0]+N[1]*n[0],b[0]*k*a[1]+N[0]*n[1],b[1]*k*a[1]+N[1]*n[1]];
 m.push(P[0]-m[0]*p[0]-m[2]*p[1],P[1]-m[1]*p[0]-m[3]*p[1]);
 return {matrix:m,sourcePivot:p,pivot:P,sourceEnd:q,targetEnd:Q,sourceLength:l,targetLength:L};
}
export function applyMatrix(m,[x,y]){return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];}
export function posePoint(bones,bone,point,frame){
 let p=[...point],seen=new Set();
 for(let id=bone;id;id=bones[id].parent){
  assert.ok(!seen.has(id),'Cyclic bone hierarchy');seen.add(id);
  const [x,y]=bones[id].pivot,a=(frame.rotations[id]||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=p[0]-x,dy=p[1]-y;
  p=[x+dx*c-dy*s,y+dx*s+dy*c];
 }
 return p;
}
export function poseMatrix(bones,bone,frame){
 const p=posePoint(bones,bone,[0,0],frame),x=posePoint(bones,bone,[1,0],frame),y=posePoint(bones,bone,[0,1],frame);
 return [x[0]-p[0],x[1]-p[1],y[0]-p[0],y[1]-p[1],...p];
}
export function groundFrame(bones,direction,frame){
 const result={...frame,rotations:{...frame.rotations},depth:{}};
 for(const side of ['Left','Right']){
  const id='shoe'+side,sole=[bones[id].pivot[0],270],posed=posePoint(bones,id,sole,result);
  const lifted=frame.forward&&(direction==='front'?side!==frame.forward:direction==='back'?side===frame.forward:false);
  result.depth[side]=(lifted?262:270)-posed[1];
 }
 return result;
}
