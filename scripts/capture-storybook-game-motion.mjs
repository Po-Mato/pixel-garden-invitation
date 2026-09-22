import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {isCompleteMotionCapture} from './lib/storybookMotionCoverage.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const zone=process.argv[3]??'home';
if(!['home','neighborhood','subway-station','subway-train'].includes(zone))throw Error('Unsupported live capture zone');
const live=process.env.STORYBOOK_CAPTURE_TARGET==='live';
const production=live||process.env.STORYBOOK_CAPTURE_TARGET==='production';
const prefix=live?'live':production?'production':'client';
const output=path.join(root,`character-assets/rigs/storybook-expansion-v1/${zone==='home'?`${prefix}-game-motion-v1`:`${prefix}-game-${zone}-motion-v1`}`);
await mkdir(output,{recursive:true});
const receipts=JSON.parse(await readFile(path.join(root,'character-assets/generated/storybook-client-qa-v1/source-copies.json'),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const selected=process.argv[2];
const catalog=JSON.parse(await readFile(path.join(root,'character-assets/rigs/guest-cutout-catalog-v1.json'),'utf8')).characters;
const presets=JSON.parse(await readFile(path.join(root,'character-assets/guest-character-presets.json'),'utf8')).presets;
const characters=catalog.map(c=>[c.characterId.replace('guest-',''),presets.find(p=>p.id===c.presetId)?.label]);
if(characters.length!==12||characters.some(c=>!c[1]))throw Error('Incomplete character catalog');
if(selected&&!characters.some(c=>c[0]===selected))throw Error('Choose a catalog character 01 through 12');
let previous=[];
if(selected){try{previous=JSON.parse(await readFile(path.join(output,'evidence.json'),'utf8')).rows;}catch(error){if(error.code!=='ENOENT')throw error;}}
const rows=previous.filter(r=>r.id!==`guest-${selected}`);
const selector='.world-player:not(.player--remote) .character-sprite--world';
try {
for(const [id,name] of characters) {
  if(selected&&id!==selected)continue;
  for(const [direction,key] of [['down','ArrowDown'],['left','ArrowLeft'],['right','ArrowRight'],['up','ArrowUp']]) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();
    const activatePortal=async name=>{
      const button=page.getByRole('button',{name,exact:true});
      await button.waitFor({state:'visible'});
      // Hover previews can cover the map portal. Use ordinary accessible
      // keyboard activation, never force-click or dispatch synthetic DOM events.
      await button.focus();
      await button.press('Enter');
    };
    const cdp=await context.newCDPSession(page);
    await page.goto(live?'https://po-mato.github.io/pixel-garden-invitation/':production?'http://127.0.0.1:4210/':'http://127.0.0.1:4197/');
    await page.getByRole('button',{name:/입장 캐릭터/}).click();
    await page.getByRole('button',{name,exact:true}).click();
    await page.getByRole('textbox',{name:'닉네임'}).fill('캐릭터검수');
    await page.getByRole('button',{name:'정원 입장',exact:true}).click();
    await page.getByRole('button',{name:'건너뛰기',exact:true}).click();
    await page.locator(selector).waitFor({state:'visible'});
    await page.locator(selector+' img').evaluate(i=>i.decode());
    if(zone!=='home'){
      await activatePortal('동네로 나가기');
      await page.locator('.world-map__stage[data-zone="neighborhood"]').waitFor({state:'visible'});
      await page.locator('[data-testid="world-portal-transition"][data-phase="idle"]').waitFor({state:'attached'});
      if(['subway-station','subway-train'].includes(zone)){
        await activatePortal('지하철역 들어가기');
        await page.locator('.world-map__stage[data-zone="subway-station"]').waitFor({state:'visible'}).catch(async error=>{
          await page.screenshot({path:path.join(output,'portal-navigation-failure.png')});
          console.error(await page.locator('body').innerText());
          console.error(await page.locator(selector).evaluate(e=>({zone:document.querySelector('.world-map__stage').dataset.zone,position:[e.parentElement.style.left,e.parentElement.style.top]})));
          throw error;
        });
        await page.locator('[data-testid="world-portal-transition"][data-phase="idle"]').waitFor({state:'attached'});
      }
      if(zone==='subway-train'){
        await activatePortal('열차 타기');
        await page.locator('.world-map__stage[data-zone="subway-train"]').waitFor({state:'visible'});
        await page.locator('[data-testid="world-portal-transition"][data-phase="idle"]').waitFor({state:'attached'});
      }
      await page.locator(selector+' img').evaluate(i=>i.decode());
      // Public keyboard movement away from the entry portal into the walkable area.
      await page.getByRole('application',{name:'가상 조이스틱'}).focus();
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(1200);
      await page.keyboard.up('ArrowRight');
      await page.waitForTimeout(100);
      if(zone==='subway-train'&&['down','up'].includes(direction)){
        const reposition=direction==='down'?'ArrowUp':'ArrowDown';
        await page.keyboard.down(reposition);
        await page.waitForTimeout(300);
        await page.keyboard.up(reposition);
        await page.waitForTimeout(100);
      }
    }
    const read=()=>page.evaluate(selector=>{const e=document.querySelector(selector),p=e.parentElement,r=e.getBoundingClientRect();return {frame:Number(e.dataset.walkFrame),moving:e.dataset.moving,direction:e.dataset.direction,preset:e.dataset.characterPreset,position:[parseFloat(p.style.left),parseFloat(p.style.top)],rect:r.toJSON(),logicalSize:[getComputedStyle(e).getPropertyValue('--character-display-width'),getComputedStyle(e).getPropertyValue('--character-display-height')],url:e.querySelector('img').src,fallback:!!e.dataset.characterFallback,changes:window.__gameFrameChanges??0,zone:document.querySelector('.world-map__stage').dataset.zone};},selector);
    await page.getByRole('application',{name:'가상 조이스틱'}).focus();
    // Walk away from the adjacent furniture using the same public controls.
    // Never teleport or change collision/state data for the capture.
    if(zone==='home'&&(direction==='right'||direction==='up')){
      const reposition=direction==='right'?'ArrowLeft':'ArrowDown';
      await page.keyboard.down(reposition);
      await page.waitForTimeout(900);
      await page.keyboard.up(reposition);
      await page.waitForTimeout(100);
    }
    const initial=await read();
    if(initial.zone!==zone)throw Error(`Expected ${zone}, found ${initial.zone}`);
    await page.evaluate(selector=>{window.__gameFrameChanges=0;new MutationObserver(ms=>window.__gameFrameChanges+=ms.filter(m=>m.attributeName==='data-walk-frame').length).observe(document.querySelector(selector),{attributes:true});},selector);
    await page.getByRole('application',{name:'가상 조이스틱'}).focus();
    await page.keyboard.down(key);
    const captures=new Map();
    const deadline=Date.now()+2500;
    while(Date.now()<deadline&&captures.size<4){
      const before=await read();
      if(before.moving!=='true'||before.direction!==direction||captures.has(before.frame)){await page.waitForTimeout(12);continue;}
      const image=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});
      const after=await read();
      if(before.frame!==after.frame||before.changes!==after.changes||after.moving!=='true'||after.direction!==direction||after.fallback)continue;
      const filename=`guest-${id}-${direction}-${before.frame}.png`;
      await writeFile(path.join(output,filename),Buffer.from(image.data,'base64'));
      captures.set(before.frame,{frame:before.frame,filename,before,after});
    }
    await page.keyboard.up(key);
    await page.waitForTimeout(100);
    const stopped=await read();
    if(captures.size!==4)throw Error(`Incomplete live movement guest-${id} ${direction}: ${captures.size} frames; position ${stopped.position}`);
    const movingUrl=[...captures.values()][0].before.url;
    const asset=await page.evaluate(async url=>{const r=await fetch(url,{cache:'no-store'});return {status:r.status,header:r.headers.get('X-Asset-SHA256'),sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('')};},movingUrl);
    const relative=new URL(movingUrl).pathname.split('/characters/generated/')[1];
    if(asset.status!==200||(!production&&asset.sha256!==asset.header)||!receipts.copies.some(r=>r.target===relative&&r.sha256===asset.sha256))throw Error('Stale runtime asset');
    const delta=stopped.position.map((v,i)=>v-initial.position[i]);
    if(stopped.moving!=='false'||Math.hypot(...delta)<1)throw Error('No actual translation or stop');
    const expected={down:[1,1],up:[1,-1],left:[0,-1],right:[0,1]}[direction];
    if(delta[expected[0]]*expected[1]<=0||Math.abs(delta[1-expected[0]])>1)throw Error('Movement direction mismatch');
    if([...captures.values()].some(c=>c.before.logicalSize[0].trim()!=='48px'||c.before.logicalSize[1].trim()!=='72px'))throw Error('Unexpected game display geometry');
    rows.push({id:`guest-${id}`,direction,initial,stopped,delta,asset,movingUrl,captures:[...captures.values()].sort((a,b)=>a.frame-b.frame)});
    await writeFile(path.join(output,'evidence.json'),JSON.stringify({captureComplete:false,visuallyInspected:false,rows},null,2)+'\n');
    console.log(`guest-${id} ${zone} ${direction}: four frames, movement ${delta}`);
    await context.close();
  }
  const tiles=[];
  for(const [index,capture] of rows.filter(r=>r.id===`guest-${id}`).flatMap(r=>r.captures).entries()){
    const r=capture.before.rect;
    // Preserve surrounding map context and actual screen pixel size in this diagnostic crop.
    const left=Math.max(0,Math.floor(r.x)-20),top=Math.max(0,Math.floor(r.y)-20);
    const width=Math.min(110,390-left),height=Math.min(140,844-top);
    tiles.push({input:await sharp(path.join(output,capture.filename)).extract({left,top,width,height}).toBuffer(),left:(index%4)*110,top:Math.floor(index/4)*140});
  }
  await sharp({create:{width:440,height:560,channels:4,background:'#eee'}}).composite(tiles).png().toFile(path.join(output,`guest-${id}-contact.png`));
}
const captureComplete=isCompleteMotionCapture(characters.map(([id])=>`guest-${id}`),rows);
await writeFile(path.join(output,'evidence.json'),JSON.stringify({captureComplete,visuallyInspected:false,viewport:[390,844],scope:`Actual ${zone} map keyboard translation with unchanged game state and movement timing`,zone,productionServiceWorkerChecked:false,rows},null,2)+'\n');
} finally {await browser.close();}
