import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=process.cwd(),url=process.argv[2]??'http://127.0.0.1:4210/';
const output=path.resolve(process.argv[3]??'character-assets/rigs/full-review-release-v1/production-browser');
await fs.mkdir(output,{recursive:true});
const manifest=JSON.parse(await fs.readFile('character-assets/generated/full-review-v1/build-manifest.json'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],rows=[];
page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto(url);await page.getByRole('button',{name:/입장 캐릭터/}).click();
for(const c of manifest.characters){
 await page.getByRole('button',{name:c.label,exact:true}).click();
 for(const [direction,label] of [['down','정면 보기'],['left','왼쪽 보기'],['right','오른쪽 보기'],['up','뒷면 보기']]){
  await page.getByRole('button',{name:label,exact:true}).click();
  const state=await page.locator('.character-sprite--preview').evaluate(async e=>{
   const i=e.querySelector('img');await i.decode();const response=await fetch(i.src,{cache:'no-store'}),bytes=await response.arrayBuffer();
   const seen=new Set(),end=performance.now()+1200;while(performance.now()<end){seen.add(e.dataset.walkFrame);await new Promise(requestAnimationFrame);}
   return {url:i.src,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join(''),status:response.status,frames:[...seen].sort(),direction:e.dataset.direction,preset:e.dataset.characterPreset,fallback:!!e.querySelector('[data-character-fallback]'),size:[e.clientWidth,e.clientHeight]};
  });
  const expected=c.outputs.find(o=>o.file===`${c.presetId}__walk-hd.png`).sha256;
  if(state.sha256!==expected||state.status!==200||state.frames.join()!=='0,1,2,3'||state.direction!==direction||state.fallback)throw Error('Production selector mismatch '+c.characterId+'/'+direction);
  const file=`${c.characterId}-${direction}.png`;await page.locator('.character-sprite--preview').screenshot({path:path.join(output,file)});
  rows.push({id:c.characterId,direction,file,...state});
 }
 console.log('Verified '+c.characterId+' four directions');
}
await page.getByRole('button',{name:manifest.characters.find(c=>c.characterId==='guest-02').label,exact:true}).click();
await page.getByRole('textbox',{name:'닉네임'}).fill('캐릭터검수');await page.getByRole('button',{name:'정원 입장',exact:true}).click();await page.getByRole('button',{name:'건너뛰기',exact:true}).click();
const sel='.world-player:not(.player--remote) .character-sprite--world';await page.locator(sel).waitFor({state:'visible'});
await page.getByRole('application',{name:'가상 조이스틱'}).focus();await page.keyboard.down('ArrowLeft');await page.waitForTimeout(500);await page.keyboard.up('ArrowLeft');
const game=await page.locator(sel).evaluate(async e=>{const i=e.querySelector('img');await i.decode();const b=await(await fetch(i.src,{cache:'no-store'})).arrayBuffer();return{direction:e.dataset.direction,preset:e.dataset.characterPreset,url:i.src,size:[getComputedStyle(e).getPropertyValue('--character-display-width'),getComputedStyle(e).getPropertyValue('--character-display-height')],sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('')};});
await page.screenshot({path:path.join(output,'game-home.png')});
const journey=[];
for(const [zone,label] of [['neighborhood','동네로 나가기'],['subway-station','지하철역 들어가기'],['subway-train','열차 타기']]){
 const portal=page.getByRole('button',{name:label,exact:true});await portal.focus();await portal.press('Enter');
 await page.locator(`.world-map__stage[data-zone="${zone}"]`).waitFor({state:'visible'});
 await page.locator('[data-testid="world-portal-transition"][data-phase="idle"]').waitFor({state:'attached'});
 await page.screenshot({path:path.join(output,`game-${zone}.png`)});
 journey.push({zone,filter:await page.locator(sel).evaluate(e=>getComputedStyle(e).filter)});
}

const runtimeHashes=[];for(const c of manifest.characters){for(const [kind,file] of [['walk-runtime',`${c.presetId}__walk.png`],['idle-runtime',`${c.presetId}__idle.png`]]){const response=await page.request.get(new URL(`characters/generated/guests/${file}`,url).href),b=await response.body(),sha256=createHash('sha256').update(b).digest('hex');if(!response.ok()||sha256!==c.outputs.find(o=>o.file===`${c.presetId}__${kind}.png`).sha256)throw Error('Runtime hash mismatch '+file);runtimeHashes.push({file,sha256});}}
if(game.direction!=='left'||errors.length)throw Error('Game/browser validation failed '+JSON.stringify({game,errors}));
const tiles=[];for(const [i,row] of rows.entries())tiles.push({input:await sharp(path.join(output,row.file)).resize(96,144).toBuffer(),left:i%8*96,top:Math.floor(i/8)*144});
await sharp({create:{width:768,height:864,channels:4,background:'#f3eee7'}}).composite(tiles).png().toFile(path.join(output,'contact.png'));
await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify({productionBuild:true,url,viewport:[390,844],complete:true,rows,runtimeHashes,game,journey,errors},null,2)+'\n');
}finally{await browser.close();}
