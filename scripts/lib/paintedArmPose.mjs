import {posePoint,poseMatrix,segmentRegistration} from './canonicalCutoutBinding.mjs';
const matrix=m=>m.map(n=>Number(n.toFixed(10))).join(' ');
// The fixed shoulder and articulated lower sleeve use the same source construction
// for neutral and walking poses. No pixels are read back or copied between frames.
export function upperArmSkin(material,bones,name,rest,frame,motion){
 const p=bones[name].pivot,q=bones[name.replace('upperArm','forearm')].pivot,y=motion.shoulderCapEnd;
 const P=posePoint(bones,name,p,rest),Q=posePoint(bones,name,q,rest);
 const hinge=[P[0]+(Q[0]-P[0])*(y-P[1])/(Q[1]-P[1]),y],elbow=posePoint(bones,name,q,frame);
 const lower=segmentRegistration(hinge,Q,hinge,elbow).matrix;
 const source=`<g transform="matrix(${matrix(poseMatrix(bones,name,rest))})">${material}</g>`;
 return `<defs><clipPath id="${name}-fixed"><rect width="192" height="${y}"/></clipPath><clipPath id="${name}-lower"><rect y="${y-motion.shoulderUnderlap}" width="192" height="288"/></clipPath></defs><g clip-path="url(#${name}-fixed)">${source}</g><g transform="matrix(${matrix(lower)})"><g clip-path="url(#${name}-lower)">${source}</g></g>`;
}
