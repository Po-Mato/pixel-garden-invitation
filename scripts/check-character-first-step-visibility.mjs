import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const url=process.argv[2]??'http://127.0.0.1:4197/';
const output=path.resolve('.superpowers/visual-regression/character-first-step',url.startsWith('https:')?'live':'local');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CI?undefined:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
const page=await context.newPage();
let release,intercepted=false;
const gate=new Promise(resolve=>{release=resolve;});
// Delay only the first runtime walk download; game state and controls are real.
await page.route('**/characters/generated/guests/feminine-sage-bolero-dress__walk.png?*',async route=>{intercepted=true;await gate;await route.continue();});
const selector='.world-player:not(.player--remote) .character-sprite--world';
const read=()=>page.locator(selector).evaluate(e=>({
  background:e.querySelector('[data-character-layer]').style.backgroundImage,
  requested:e.querySelector('img').src,
  imageReady:e.querySelector('img').complete&&e.querySelector('img').naturalWidth>0,
  idle:e.classList.contains('character-sprite--idle-front'),moving:e.dataset.moving
}));
try {
  await page.goto(url);
  await page.getByRole('button',{name:/입장 캐릭터/}).click();
  await page.getByRole('button',{name:'세이지 리본 원피스',exact:true}).click();
  await page.getByRole('textbox',{name:'닉네임'}).fill('첫걸음검수');
  await page.getByRole('button',{name:'정원 입장',exact:true}).click();
  await page.getByRole('button',{name:'건너뛰기',exact:true}).click();
  await page.locator(selector+' img').evaluate(i=>i.decode());
  await page.getByRole('application',{name:'가상 조이스틱'}).focus();
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.moving==='true',selector);
  await page.waitForTimeout(300);
  const pending=await read();
  await page.screenshot({path:path.join(output,'pending-walk.png')});
  assert.equal(intercepted,true);
  assert.match(pending.requested,/__walk\.png/);
  assert.equal(pending.imageReady,false);
  assert.equal(pending.moving,'true');
  assert.equal(pending.idle,true,'Pending walk must retain a visible decoded pose');
  assert.match(pending.background,/__idle\.png/);
  release();
  await page.waitForFunction(selector=>{const e=document.querySelector(selector),i=e.querySelector('img');return i.complete&&i.naturalWidth>0&&!e.classList.contains('character-sprite--idle-front');},selector);
  const loaded=await read();
  await page.screenshot({path:path.join(output,'loaded-walk.png')});
  assert.match(loaded.background,/__walk\.png/);
  await page.keyboard.up('ArrowDown');
  await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.moving==='false',selector);
  const stopped=await read();assert.equal(stopped.idle,true);
  const report={passed:true,url,viewport:[390,844],pending,loaded,stopped,scope:'Delayed first walk request preserves decoded idle; actual keyboard movement. Screenshots require separate visual inspection.'};
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:true,output}));
} finally {release();await browser.close();}
