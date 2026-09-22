import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from './deterministicSharp.mjs';
import {assertPaintedSourceOverlay} from './paintedSourceOverlay.mjs';

// Editable material in the ORIGINAL artwork coordinates, before head layer
// ownership, alpha masking, registration or animation. Never reads a frame.
export async function readPaintedHeadMaterial(base,part){
  const source=await readFile(path.resolve(base,part.source));
  const original=await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const overlays=[];
  assert.ok(part.sourceOverlays===undefined||Array.isArray(part.sourceOverlays));
  let data=original.data;
  for(const file of part.sourceOverlays||[]){
    const bytes=await readFile(path.resolve(base,file));
    assertPaintedSourceOverlay(file,bytes,await sharp(bytes).metadata(),original.info);
    // The independent source matte remains authoritative for alpha. Painting
    // opaque source RGB prevents repeated premultiplication of its edge alpha.
    data=await sharp(data,{raw:original.info}).composite([{input:bytes}]).removeAlpha().raw().toBuffer();
    overlays.push({file,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  return {data,info:original.info,overlays};
}
