import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('dark and warm source ink jointly preserves navy, skin and cream without gray exterior',async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'storybook-dark-warm-'));
  const source=path.join(folder,'fixture.png');
  try {
    await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120"><rect width="100" height="120" fill="#aaa"/><path d="M25 15H75V65H25Z" fill="#344a72" stroke="#15213b" stroke-width="6"/><path d="M25 62H75V105H25Z" fill="#ffdcbb" stroke="#a56a46" stroke-width="6"/><rect x="35" y="35" width="30" height="12" fill="#fff9ee"/></svg>')).png().toFile(source);
    const svg=execFileSync(process.execPath,[path.join(root,'scripts/trace-storybook-head-matte.mjs'),source,'--dark-warm-outline']);
    const alpha=await sharp(svg).ensureAlpha().extractChannel(3).raw().toBuffer();
    for(const [x,y] of [[50,25],[50,40],[50,85]])assert.equal(alpha[y*100+x],255);
    for(const [x,y] of [[5,25],[5,85],[50,115]])assert.equal(alpha[y*100+x],0);
  } finally {await fs.unlink(source);await fs.rmdir(folder);}
});
test('guest10 navy sleeve sources keep skin and reject checker including thumb gap',async()=>{
  const base=path.join(root,'character-assets/rigs/guest-10/storybook-source-v1/masks');
  // At left x482 the original is brown thumb ink; the actual achromatic gap
  // is x485 (source RGB 225/224/222). Use the source landmark, not its outline.
  for(const [name,hand,gap] of [['armRight-left',[515,1250],[485,1310]],['armRight-back',[480,1250],[414,1270]]]){
    const {data,info}=await sharp(path.join(base,name+'-v1.svg')).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
    const alpha=p=>data[p[1]*info.width+p[0]];
    assert.equal(alpha([530,400]),255,'navy sleeve');
    assert.equal(alpha([530,900]),255,'skin forearm');
    assert.equal(alpha(hand),255,'hand interior');
    assert.equal(alpha(gap),0,'thumb gap');
    assert.equal(alpha([100,900]),0,'checker exterior');
  }
});
test('mixed source drafting treats transparent black as exterior, preserving enclosed cream',async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'storybook-mixed-matte-'));
  const source=path.join(folder,'mixed-source.png');
  try {
    await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120"><rect x="8" y="8" width="84" height="104" fill="#aaa"/><path d="M25 18H75V100H25Z" fill="#fff9ee" stroke="#222" stroke-width="6"/></svg>')).png().toFile(source);
    const svg=execFileSync(process.execPath,[path.join(root,'scripts/trace-storybook-head-matte.mjs'),source,'--mixed-outline']);
    const alpha=await sharp(svg).ensureAlpha().extractChannel(3).raw().toBuffer();
    assert.equal(alpha[60*100+50],255);
    assert.equal(alpha[60*100+10],0);
    assert.equal(alpha[60*100+1],0);
    assert.equal(alpha[5*100+50],0);
  } finally {await fs.unlink(source);await fs.rmdir(folder);}
});
test('closed-outline source draft retains enclosed white and cream, rejects exterior background',async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'storybook-source-matte-'));
  const source=path.join(folder,'opaque-source.png');
  // Test fixture, not character artwork. White cuff touches dark cloth inside a closed ink outline.
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120"><rect width="100" height="120" fill="white"/><path d="M20 10H80V110H20Z" fill="#fff9ee" stroke="#151515" stroke-width="6"/><path d="M23 13H77V65H23Z" fill="#55575b"/><path d="M23 70H77V90H23Z" fill="white"/></svg>')).png().toFile(source);
  const svg=execFileSync(process.execPath,[path.join(root,'scripts/trace-storybook-head-matte.mjs'),source,'--closed-outline']);
  const alpha=await sharp(svg).ensureAlpha().extractChannel(3).raw().toBuffer();
  assert.equal(alpha[80*100+50],255,'white cuff must survive');
  assert.equal(alpha[100*100+50],255,'cream inside ink outline must survive');
  assert.equal(alpha[80*100+5],0,'white exterior must be transparent');
  assert.equal(alpha[5*100+50],0);
  // Only our exact temporary fixture and empty directory are removed.
  await fs.unlink(source);await fs.rmdir(folder);
});
test('guest11 mixed-background source mattes preserve cream cloth and reject exterior',async()=>{
  const base=path.join(root,'character-assets/rigs/guest-11/storybook-source-v1/masks');
  for(const [name,inside,outside] of [
    ['torso-left',[550,150],[50,900]],
    ['torso-right',[530,180],[950,1000]],
    ['legLeft-front',[350,1000],[20,1000]],
    ['leg-right',[250,500],[750,700]],
    ['armRight-front',[350,1760],[20,1760]],
    ['armLeft-front',[350,1730],[20,1730]],
    ['armLeft-back',[350,1800],[20,1800]]
  ]){
    const {data,info}=await sharp(path.join(base,name+'-v1.svg')).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
    assert.equal(data[inside[1]*info.width+inside[0]],255,name+': retained cloth');
    assert.equal(data[outside[1]*info.width+outside[0]],0,name+': rejected exterior');
  }
});
test('guest04 opaque sleeve mattes preserve white cuffs, hands and thumb gaps',async()=>{
  const base=path.join(root,'character-assets/rigs/guest-04/storybook-source-v1/masks');
  for(const [name,cuff,hand,gap] of [
    ['arm-left',[350,1720],[380,1900],[332,1980]],
    ['armLeft-back',[350,1790],[350,1950],[440,2040]],
    ['armRight-back',[350,1740],[350,1900],[250,2010]]
  ]){
    const {data,info}=await sharp(path.join(base,name+'-v1.svg')).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
    const alpha=p=>data[p[1]*info.width+p[0]];
    assert.equal(alpha(cuff),255,name+': white cuff');
    assert.equal(alpha(hand),255,name+': hand interior');
    assert.equal(alpha(gap),0,name+': background between thumb and fingers');
    assert.equal(alpha([50,1900]),0,name+': outer background');
  }
});
