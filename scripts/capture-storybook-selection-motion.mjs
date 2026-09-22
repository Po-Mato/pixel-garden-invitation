import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

// Diagnostic UI screenshots only. Does not modify the rendered character assets.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const live=process.env.STORYBOOK_CAPTURE_TARGET==='live';
const production=live||process.env.STORYBOOK_CAPTURE_TARGET==='production';
const output=path.join(root,`character-assets/rigs/storybook-expansion-v1/${live?'live':production?'production':'client'}-selection-motion-v1`);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:390,height:844}});
const cdp=await page.context().newCDPSession(page);
const evaluate=code=>page.evaluate(code);
await page.goto(live?'https://po-mato.github.io/pixel-garden-invitation/':production?'http://127.0.0.1:4210/':'http://127.0.0.1:4197/');
await page.getByRole('button',{name:/입장 캐릭터/}).click();
await mkdir(output,{recursive:true});
const receipts=JSON.parse(await readFile(path.join(root,'character-assets/generated/storybook-client-qa-v1/source-copies.json'),'utf8'));
const selected=process.argv[2];
const catalog=JSON.parse(await readFile(path.join(root,'character-assets/rigs/guest-cutout-catalog-v1.json'),'utf8')).characters;
const presets=JSON.parse(await readFile(path.join(root,'character-assets/guest-character-presets.json'),'utf8')).presets;
const characters=catalog.map(c=>[c.characterId.replace('guest-',''),presets.find(p=>p.id===c.presetId)?.label]);
if(characters.length!==12||characters.some(c=>!c[1]))throw Error('Incomplete character catalog');
if(selected&&!characters.some(c=>c[0]===selected))throw Error('Choose a catalog character 01 through 12');
const previous=selected?JSON.parse(await readFile(path.join(output,'evidence.json'),'utf8')).rows:[];
const rows=previous.filter(r=>r.id!==`guest-${selected}`);
try {
for(const [id,name] of characters) {
  if(selected&&id!==selected)continue;
  await page.getByRole('button',{name,exact:true}).click();
  for(const [direction,label] of [['down','정면 보기'],['left','왼쪽 보기'],['right','오른쪽 보기'],['up','뒷면 보기']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    const asset=await evaluate(`(async()=>{const e=document.querySelector('.character-sprite--preview');const i=e.querySelector('img');await i.decode();const r=await fetch(i.src,{cache:'no-store'});const bytes=await r.arrayBuffer();return {url:i.src,status:r.status,header:r.headers.get('X-Asset-SHA256'),sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join(''),preset:e.dataset.characterPreset};})()`);
    const relative=new URL(asset.url).pathname.split('/characters/generated/')[1];
    if(asset.status!==200||(!production&&asset.sha256!==asset.header)||!receipts.copies.some(r=>r.target===relative&&r.sha256===asset.sha256))throw new Error('Stale asset: '+relative);
    for(let frame=0;frame<4;frame++) {
      let accepted;
      const filename=`guest-${id}-${direction}-${frame}.png`;
      for(let attempt=0;attempt<12&&!accepted;attempt++) {
        const before=await evaluate(`(async()=>{const e=document.querySelector('.character-sprite--preview');window.__motionObservation?.disconnect();window.__motionChanges=0;window.__motionObservation=new MutationObserver(ms=>{window.__motionChanges+=ms.filter(m=>m.attributeName==='data-walk-frame').length});window.__motionObservation.observe(e,{attributes:true});const deadline=performance.now()+4000;let seenOther=false;while(performance.now()<deadline){if(e.dataset.walkFrame!=='${frame}')seenOther=true;if(seenOther&&e.dataset.walkFrame==='${frame}'){await new Promise(requestAnimationFrame);window.__motionChanges=0;return {frame:e.dataset.walkFrame,direction:e.dataset.direction,moving:e.dataset.moving,rect:e.getBoundingClientRect().toJSON(),time:performance.now()};}await new Promise(requestAnimationFrame);}throw Error('Frame transition timeout')})()`);
        const capture=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});
        await writeFile(path.join(output,filename),Buffer.from(capture.data,'base64'));
        const after=await evaluate(`(()=>{const e=document.querySelector('.character-sprite--preview');return {frame:e.dataset.walkFrame,direction:e.dataset.direction,moving:e.dataset.moving,changes:window.__motionChanges,time:performance.now(),fallback:!!e.querySelector('[data-character-fallback]')};})()`);
        if(before.frame===String(frame)&&after.frame===String(frame)&&after.changes===0&&before.direction===direction&&after.direction===direction&&after.moving==='true'&&!after.fallback)accepted={id:`guest-${id}`,direction,frame,filename,before,after,asset,attempts:attempt+1};
        else console.log('Capture crossed frame',filename,{before:before.frame,after:after.frame,changes:after.changes,duration:after.time-before.time,moving:after.moving});
      }
      if(!accepted)throw new Error('Could not capture stable frame '+filename);
      rows.push(accepted);
      await writeFile(path.join(output,'evidence.json'),JSON.stringify({viewport:[390,844],captureComplete:false,visuallyInspected:false,productionChanged:false,rows},null,2)+'\n');
    }
    console.log(`Captured guest-${id} ${direction}: all four live frames`);
  }
  const tiles=[];
  for(const [index,row] of rows.filter(r=>r.id===`guest-${id}`).entries()) {
    const rect=row.before.rect;
    tiles.push({input:await sharp(path.join(output,row.filename)).extract({left:Math.floor(rect.x),top:Math.floor(rect.y),width:Math.ceil(rect.width),height:Math.ceil(rect.height)}).toBuffer(),left:(index%4)*160,top:Math.floor(index/4)*240});
  }
  await sharp({create:{width:640,height:960,channels:4,background:'#f7f3eb'}}).composite(tiles).png().toFile(path.join(output,`guest-${id}-contact.png`));
}
await writeFile(path.join(output,'evidence.json'),JSON.stringify({viewport:[390,844],captureComplete:true,visuallyInspected:false,productionChanged:false,layout:'rows down,left,right,up; columns frame 0,1,2,3; exact-size preview crops from full UI screenshots',rows},null,2)+'\n');
} finally {await browser.close();}
