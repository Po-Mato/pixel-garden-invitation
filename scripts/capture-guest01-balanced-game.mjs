import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const variant=process.argv[3]||'balanced-arms-four-direction-v2';assert.ok(['balanced-arms-four-direction-v2','balanced-shading-v3'].includes(variant));
const out=path.join(root,'character-assets/rigs/guest-01/storybook-source-v1/review',variant);
const port=variant==='balanced-shading-v3'?4202:4201;
const zone=process.argv[2]||'home';assert.ok(['home','neighborhood'].includes(zone));
const expected=createHash('sha256').update(await fs.readFile(path.join(out,'walk-runtime.png'))).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const rows=[];
try{
for(const [direction,key] of [['down','ArrowDown'],['left','ArrowLeft'],['right','ArrowRight'],['up','ArrowUp']]){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const page=await context.newPage();
 await page.goto(`http://127.0.0.1:${port}/`);
 await page.getByRole('button',{name:/입장 캐릭터/}).click();
 await page.getByRole('button',{name:'크림 롱 웨이브 원피스',exact:true}).click();
 await page.getByRole('textbox',{name:'닉네임'}).fill('팔원화검수');
 await page.getByRole('button',{name:'정원 입장',exact:true}).click();
 await page.getByRole('button',{name:'건너뛰기',exact:true}).click();
 const selector='.world-player:not(.player--remote) .character-sprite--world';
 await page.locator(selector).waitFor({state:'visible'});
 if(zone==='neighborhood'){
   const portal=page.getByRole('button',{name:'동네로 나가기',exact:true});await portal.focus();await portal.press('Enter');
   await page.locator('.world-map__stage[data-zone="neighborhood"]').waitFor({state:'visible'});
   await page.locator('[data-testid="world-portal-transition"][data-phase="idle"]').waitFor({state:'attached'});
   await page.getByRole('application',{name:'가상 조이스틱'}).focus();
   await page.keyboard.down('ArrowUp');await page.waitForTimeout(900);await page.keyboard.up('ArrowUp');
   await page.keyboard.down('ArrowRight');await page.waitForTimeout(600);await page.keyboard.up('ArrowRight');
   if(direction==='up'){await page.keyboard.down('ArrowDown');await page.waitForTimeout(900);await page.keyboard.up('ArrowDown');}
 }
 await page.getByRole('application',{name:'가상 조이스틱'}).focus();
 if(zone==='home'&&(direction==='right'||direction==='up')){
   await page.keyboard.down(direction==='right'?'ArrowLeft':'ArrowDown');
   await page.waitForTimeout(900);
   await page.keyboard.up(direction==='right'?'ArrowLeft':'ArrowDown');
 }
 const read=()=>page.locator(selector).evaluate(e=>({frame:e.dataset.walkFrame,moving:e.dataset.moving,direction:e.dataset.direction,position:[parseFloat(e.parentElement.style.left),parseFloat(e.parentElement.style.top)],size:[getComputedStyle(e).getPropertyValue('--character-display-width'),getComputedStyle(e).getPropertyValue('--character-display-height')],rect:e.getBoundingClientRect().toJSON(),url:e.querySelector('img').src}));
 const before=await read(),seen=new Set();
 await page.keyboard.down(key);
 for(let n=0;n<24;n++){await page.waitForTimeout(50);const s=await read();if(s.moving==='true'&&s.direction===direction)seen.add(s.frame);if(zone==='neighborhood'&&seen.size===4&&n>=12)break;}
 const moving=await read();
 await page.screenshot({path:path.join(out,`client-game-${zone==='home'?'':zone+'-'}${direction}.png`)});
 await page.keyboard.up(key);
 await page.waitForTimeout(100);
 const stopped=await read();
 const response=await page.request.get(moving.url);
 const sha256=createHash('sha256').update(await response.body()).digest('hex');
 assert.equal(sha256,expected);assert.equal(response.headers()['x-character-qa'],'guest01-balanced-candidate');
 assert.deepEqual(moving.size,['48px','72px']);assert.equal(seen.size,4);assert.equal(stopped.moving,'false');
 const axis=['left','right'].includes(direction)?0:1,delta=moving.position[axis]-before.position[axis];
 assert.ok(['left','up'].includes(direction)?delta<0:delta>0,'Actual movement must match sprite direction');
 rows.push({direction,before,moving,stopped,frames:[...seen],delta,sha256});
 await fs.writeFile(path.join(out,`client-game-${zone==='home'?'':zone+'-'}evidence.json`),JSON.stringify({viewport:[390,844],scope:`isolated candidate actual client ${zone} map`,captureComplete:rows.length===4,serviceWorkers:'blocked in this local QA context only',productionChanged:false,visualApproved:false,rows},null,2)+'\n');
 console.log(direction,delta,[...seen]);await context.close();
}
await fs.writeFile(path.join(out,`client-game-${zone==='home'?'':zone+'-'}evidence.json`),JSON.stringify({viewport:[390,844],scope:`isolated candidate actual client ${zone} map`,captureComplete:rows.length===4,serviceWorkers:'blocked in this local QA context only',productionChanged:false,visualApproved:false,rows},null,2)+'\n');
}finally{await browser.close();}
