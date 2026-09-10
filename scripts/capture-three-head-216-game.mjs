import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const stagedRuntime=process.argv.includes('--staged-runtime');
const productionPreview=process.argv.includes('--production-preview');
assert.ok(!(stagedRuntime&&productionPreview),'Choose one capture mode');
const root=new URL('../',import.meta.url),session=productionPreview?'guest216production':stagedRuntime?'guest216runtime':'guest216app';
const labels=['크림 롱 웨이브 원피스','로즈 여성 한복','네이비 클래식 수트','차콜 클래식 수트','세이지 리본 원피스','샴페인 블라우스 스커트','라벤더 쉬폰 원피스','더스티 로즈 원피스','베이지 썸머 수트','네이비 포멀 원피스','그린 블레이저 크림 팬츠','블루 모던 한복'];
function b(...args){return execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:30000}).trim();}
function ev(code){const r=JSON.parse(b('eval',code));return typeof r==='string'?JSON.parse(r):r;}
const hash=b=>createHash('sha256').update(b).digest('hex');
const requested=process.argv.slice(2).filter(a=>!['--staged-runtime','--production-preview'].includes(a));
const catalog=JSON.parse(await readFile(new URL('character-assets/rigs/guest-cutout-catalog-v1.json',root)));
if(stagedRuntime){b('open','http://127.0.0.1:5197/');b('set','viewport','390','844');}
if(productionPreview){b('open','http://127.0.0.1:5198/');b('set','viewport','390','844');}
for(const id of requested)assert.match(id,/^guest-(0[1-9]|1[0-2])$/);
for(const[i,label]of labels.entries()){
 const id='guest-'+String(i+1).padStart(2,'0'),base=new URL(`character-assets/rigs/${id}/three-head-216-v1/review/`,root);
 if(requested.length&&!requested.includes(id))continue;
 const preset=catalog.characters.find(c=>c.characterId===id).presetId;
 const sheetFile=productionPreview?new URL(`client/dist/characters/generated/guests/${preset}__walk.png`,root):stagedRuntime?new URL(`character-assets/generated/three-head-216-v1/${preset}/${preset}__walk-runtime.png`,root):new URL('walk-sheet.png',base);
 const expectedUrl=productionPreview?`characters/generated/guests/${preset}__walk.png?v=guest-soft-tailoring-v1-20260911`:'/__guest216-pilot/'+id+(stagedRuntime?'-runtime':'')+'.png';
 const outputPrefix=productionPreview?'production-preview-':stagedRuntime?'runtime-':'';
 const initialSheetSha256=hash(await readFile(sheetFile));
 const frameWidth=stagedRuntime||productionPreview?96:192,frameHeight=stagedRuntime||productionPreview?144:288;
 b('reload');b('wait','.entry-screen__character-access');b('click','.entry-screen__character-access');
 b('find','role','button','click','--name',label,'--exact');b('fill','input[name="nickname"]','리그216 검수');
 b('find','role','button','click','--name','정원 입장','--exact');b('wait','.character-sprite--world');
 if(ev('JSON.stringify(Array.from(document.querySelectorAll("button")).some(e=>e.textContent.trim()==="건너뛰기"))'))b('find','role','button','click','--name','건너뛰기','--exact');
 b('wait','--fn','document.querySelector(".virtual-joystick")?.getAttribute("aria-disabled")==="false"');
 // Saved journeys preserve position. Walk to the clear room centre before measuring.
 const origin=ev(`(async()=>{const e=document.querySelector('.character-sprite--world'),j=document.querySelector('.virtual-joystick');for(const[axis,target,negative,positive]of [['left',285,'ArrowLeft','ArrowRight'],['top',375,'ArrowUp','ArrowDown']]){const start=parseFloat(e.parentElement.style[axis]);if(start===target)continue;const key=start>target?negative:positive;j.focus();j.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));try{for(let n=0;n<180;n++){const v=parseFloat(e.parentElement.style[axis]);if(start>target?v<=target:v>=target)break;await new Promise(r=>setTimeout(r,20))}}finally{j.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true,cancelable:true}))}await new Promise(r=>setTimeout(r,300))}return JSON.stringify([parseFloat(e.parentElement.style.left),parseFloat(e.parentElement.style.top)])})()`);
 assert.deepEqual(origin,[285,375],'known clear map route reached using actual input');
 const rows=[],screenshots=[];
 for(const[direction,key,row]of [['left','ArrowLeft',1],['right','ArrowRight',2],['up','ArrowUp',3],['down','ArrowDown',0]]){
  // Actual React joystick keyboard events, never writing game state or avatar DOM.
  const result=ev(`(async()=>{const e=document.querySelector('.character-sprite--world'),j=document.querySelector('[aria-label="가상 조이스틱"]'),samples=[];j.focus();j.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},bubbles:true,cancelable:true}));try{for(let i=0;i<16;i++){const r=e.getBoundingClientRect(),l=e.querySelector('.character-layer');samples.push({direction:e.dataset.direction,moving:e.dataset.moving,frame:Number(e.dataset.walkFrame),size:[r.width,r.height],position:[parseFloat(e.parentElement.style.left),parseFloat(e.parentElement.style.top)],sheetPosition:l.style.backgroundPosition,url:l.style.backgroundImage});await new Promise(r=>setTimeout(r,80))}}finally{j.dispatchEvent(new KeyboardEvent('keyup',{key:${JSON.stringify(key)},bubbles:true,cancelable:true}))}await new Promise(r=>setTimeout(r,400));return JSON.stringify({samples,stopped:{direction:e.dataset.direction,moving:e.dataset.moving,frame:Number(e.dataset.walkFrame)}})})()`);
  const moving=result.samples.filter(s=>s.moving==='true'&&s.direction===direction);assert.ok(moving.length>0,id+' '+direction+' must actually move');
  assert.deepEqual([...new Set(moving.map(s=>s.frame))].sort(),[0,1,2,3]);
  for(const s of moving){assert.deepEqual(s.size,[48,72]);assert.ok(s.url.includes(expectedUrl));assert.equal(s.sheetPosition,`${s.frame===0?0:-s.frame*frameWidth}px ${row===0?0:-row*frameHeight}px`);}
  const axis=direction==='left'||direction==='right'?0:1,delta=moving.at(-1).position[axis]-moving[0].position[axis];assert.ok(direction==='left'||direction==='up'?delta<0:delta>0);
  assert.deepEqual(result.stopped,{direction,moving:'false',frame:1});rows.push({direction,...result});
  const file=`local-game-216-${outputPrefix}${direction}.png`;b('screenshot',fileURLToPath(new URL(file,base)));screenshots.push({file,sha256:hash(await readFile(new URL(file,base)))});
 }
 const sheetSha256=hash(await readFile(sheetFile));
 assert.equal(sheetSha256,initialSheetSha256,'Source sheet changed during browser capture; rerun after rendering finishes');
 let response;
 if(productionPreview){response=ev(`(async()=>{const r=await fetch(${JSON.stringify('/'+expectedUrl)}),digest=await crypto.subtle.digest('SHA-256',await r.arrayBuffer());return JSON.stringify({status:r.status,sha256:Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join(''),controller:navigator.serviceWorker.controller?.scriptURL??null})})()`);assert.equal(response.status,200);assert.equal(response.sha256,sheetSha256);}
 await writeFile(new URL(`local-game-216-${outputPrefix}review.json`,base),JSON.stringify({id,developmentOnly:!productionPreview,productionPreview,productionIntegrated:productionPreview,remoteProductionVerified:false,stagedRuntime,sourceFrameSize:[frameWidth,frameHeight],viewport:[390,844],sheetSha256,sourceSheetSha256:hash(await readFile(new URL('walk-sheet.png',base))),response,rows,screenshots,visualReview:'Captured real joystick movement; screenshots require separate visual inspection.'},null,2)+'\n');
 console.log(id+': real map 48x72, four movement directions/frames and neutral stop verified.');
}
