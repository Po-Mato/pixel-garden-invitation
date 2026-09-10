// Editable source-art registration, independent of animation frames.
// A larger virtual artboard adds only transparent space; original image pixels
// remain at (0,0), at their original resolution. Scene slots/bones are unchanged.
export function originalViewport(part, metadata) {
 const imageSize=[metadata.width,metadata.height];
 const canvas=part.registrationCanvas??imageSize;
 if(!Array.isArray(canvas)||canvas.length!==2||canvas.some((n,i)=>!Number.isInteger(n)||n<imageSize[i]))throw Error('Invalid original registration canvas');
 const viewport=part.sourceViewport??[0,0,...canvas];
 if(!Array.isArray(viewport)||viewport.length!==4||viewport.some(n=>!Number.isFinite(n)))throw Error('Invalid original viewport');
 const [x,y,w,h]=viewport;
 if(x<0||y<0||w<=0||h<=0||x+w>canvas[0]||y+h>canvas[1])throw Error('Original viewport outside its declared canvas');
 return {canvas,viewport};
}
