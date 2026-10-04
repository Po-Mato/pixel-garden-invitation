export const neckSourceFile='character-assets/rigs/hanbok-directions-v8/neck-source.json';
export function neckSource(config,id,direction){
 const d=config.characters[id]?.[direction];if(!d)throw new Error(`Missing neck original: ${id}/${direction}`);
 return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288"><defs><linearGradient id="skin" x2="0" y2="1"><stop stop-color="#e8ad8d"/><stop offset="1" stop-color="#ffddbe"/></linearGradient></defs><path fill="url(#skin)" d="${d}"/></svg>`);
}
