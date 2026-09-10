import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const path=process.argv[2];if(!path)throw new Error('Original image path required');
const bytes=await readFile(path),meta=await sharp(bytes).metadata();
if(!meta.hasAlpha){console.log(JSON.stringify({path,hasAlpha:false,channels:meta.channels}));process.exit(1);}
const {data,info}=await sharp(bytes).raw().toBuffer({resolveWithObject:true});
let transparentPixels=0,left=info.width,top=info.height,right=-1,bottom=-1;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
 const alpha=data[(y*info.width+x)*info.channels+info.channels-1];
 if(alpha===0)transparentPixels++;
 if(alpha>=128){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
}
console.log(JSON.stringify({path,hasAlpha:true,channels:meta.channels,imageSize:[info.width,info.height],transparentPixels,opaqueBoundsAlpha128:[left,top,right-left+1,bottom-top+1],sha256:createHash('sha256').update(bytes).digest('hex')}));
if(!transparentPixels||right<0)process.exitCode=1;
