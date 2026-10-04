export const collarFile='character-assets/rigs/hanbok-directions-v8/collar-layers.json';
export function collarLayers(config,id,dir,original){
 const opening=config.characters[id][dir];
 const neck=`<defs><linearGradient id="neck-skin" x2="0" y2="1"><stop stop-color="#e8ad8d"/><stop offset="1" stop-color="#ffddbe"/></linearGradient></defs><path d="${opening}" fill="url(#neck-skin)"/>`;
 const collar=`<defs><clipPath id="collar-front"><path clip-rule="evenodd" d="M 85 117 H 108 V 144 H 85 Z ${opening}"/></clipPath></defs><g clip-path="url(#collar-front)">${original}</g>`;
 return {neck,collar};
}
