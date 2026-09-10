import assert from 'node:assert/strict';

// An authored part material, evaluated before joint transforms. Never reads or edits output PNGs.
export function renderRigMaterial(texture, material, name) {
 if(!material)return texture;
 if(material.type==='inner-edge-shading'){
  assert.match(name,/^[a-zA-Z][a-zA-Z0-9]*$/);
  assert.match(material.color,/^#[0-9a-fA-F]{6}$/);
  assert.ok(Number.isFinite(material.radius)&&material.radius>0&&material.radius<=3);
  assert.ok(Number.isFinite(material.opacity)&&material.opacity>0&&material.opacity<=1);
  const id='edge-material-'+name;
  // Authored fabric rim shading inside the part silhouette, before joint transforms.
  // Restore the original alpha exactly: no external outline or body-size change.
  return `<defs><filter id="${id}" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="erode" radius="${material.radius}" result="inside"/><feComposite in="SourceAlpha" in2="inside" operator="out" result="rim"/><feFlood flood-color="${material.color}" flood-opacity="${material.opacity}"/><feComposite in2="rim" operator="in"/><feComposite in2="SourceGraphic" operator="over"/><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs><g filter="url(#${id})">${texture}</g>`;
 }
 assert.equal(material.type,'gradient-map');
 assert.match(name,/^[a-zA-Z][a-zA-Z0-9]*$/);
 assert.ok(Array.isArray(material.colors)&&material.colors.length>=2);
 const colors=material.colors.map(hex=>{
  assert.match(hex,/^#[0-9a-fA-F]{6}$/);
  return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 });
 const id='material-'+name;
 assert.ok(material.pigment===undefined||material.pigment==='green');
 const selective=material.pigment==='green'
  ? '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -32 32 0 0 0" result="pigment"/><feComposite in="mapped" in2="pigment" operator="in" result="dyed"/><feComposite in="SourceGraphic" in2="pigment" operator="out" result="untouched"/><feComposite in="dyed" in2="untouched" operator="arithmetic" k2="1" k3="1"/>'
  : '';
 return '<defs><filter id="'+id+'" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer>'+
  ['R','G','B'].map((c,i)=>'<feFunc'+c+' type="table" tableValues="'+colors.map(rgb=>rgb[i].toFixed(6)).join(' ')+'"/>').join('')+
  '</feComponentTransfer><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="mapped"/>'+selective+'</filter></defs><g filter="url(#'+id+')">'+texture+'</g>';
}
