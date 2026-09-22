import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const variant=process.argv[2]||'balanced-shading-v3';assert.ok(['balanced-arms-four-direction-v2','balanced-shading-v3'].includes(variant));
const out=path.join(root,'character-assets/rigs/guest-01/storybook-source-v1/review',variant),port=variant==='balanced-shading-v3'?4202:4201;
const hash=b=>createHash('sha256').update(b).digest('hex');
const expected=hash(await fs.readFile(path.join(out,'walk.png')));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(`http://127.0.0.1:${port}/`);
 await page.getByRole('button',{name:/입장 캐릭터/}).click();
 const options=page.locator('.customizer-option--image'),sprite=page.locator('.character-customizer__sprite .character-sprite');
 assert.equal(await options.count(),12);const switched=[];
 for(let i=0;i<12;i++){
  const option=options.nth(i),label=await option.getAttribute('aria-label');await option.click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.character-customizer__sprite img')].every(i=>i.complete&&i.naturalWidth>0));
  const state=await sprite.evaluate(e=>({preset:e.dataset.characterPreset,fallback:e.dataset.characterFallback||false,url:e.querySelector('img').src}));
  assert.equal(state.fallback,false);const r=await page.request.get(state.url);assert.equal(r.status(),200);
  switched.push({label,...state,sha256:hash(await r.body()),header:r.headers()['x-character-qa']});
  await page.locator('.character-customizer__preview').screenshot({path:path.join(out,`selection-preset-${String(i+1).padStart(2,'0')}.png`)});
 }
 assert.equal(new Set(switched.map(s=>s.preset)).size,12);
 await page.getByRole('button',{name:'크림 롱 웨이브 원피스',exact:true}).click();
 if(await sprite.getAttribute('data-moving')!=='true')await page.getByRole('button',{name:'보행 애니메이션 재생',exact:true}).click();
 const rows=[];
 for(const [direction,label] of [['down','정면'],['left','왼쪽'],['right','오른쪽'],['up','뒷면']]){
  await page.getByRole('button',{name:label+' 보기',exact:true}).click();const frames=new Set();
  for(let n=0;n<24&&frames.size<4;n++){frames.add(await sprite.getAttribute('data-walk-frame'));await page.waitForTimeout(70);}
  assert.equal(frames.size,4);assert.equal(await sprite.getAttribute('data-direction'),direction);
  const state=await sprite.evaluate(e=>({url:e.querySelector('img').src,rect:e.getBoundingClientRect().toJSON(),width:getComputedStyle(e).getPropertyValue('--character-display-width'),height:getComputedStyle(e).getPropertyValue('--character-display-height'),serviceWorkerControlled:!!navigator.serviceWorker?.controller}));
  const r=await page.request.get(state.url),sha256=hash(await r.body());assert.equal(sha256,expected);assert.equal(state.serviceWorkerControlled,false);
  rows.push({direction,...state,frames:[...frames],sha256,header:r.headers()['x-character-qa']});
  await page.screenshot({path:path.join(out,`client-selection-${direction}.png`)});
 }
 await page.getByRole('button',{name:'보행 애니메이션 정지',exact:true}).click();
 const stop=await sprite.evaluate(e=>({moving:e.dataset.moving==='true',frame:e.dataset.walkFrame}));assert.deepEqual(stop,{moving:false,frame:'1'});
 await fs.writeFile(path.join(out,'client-selection-evidence.json'),JSON.stringify({viewport:[390,844],captureComplete:true,productionChanged:false,visualApproved:false,rows,switched,stop},null,2)+'\n');
 console.log('12 selections, four directions, four walk frames and stopped neutral verified; no active service worker in this fresh local context.');
}finally{await browser.close();}
