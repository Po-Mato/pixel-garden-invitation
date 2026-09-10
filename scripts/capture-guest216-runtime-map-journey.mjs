import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const base=new URL('../character-assets/rigs/common-three-head-216-v1/',import.meta.url),session='guest216runtime';
const b=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:30000}).trim();
const ev=code=>JSON.parse(JSON.parse(b('eval',`JSON.stringify(${code})`)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const sheet=new URL('../../generated/three-head-216-v1/masculine-blue-modern-hanbok/masculine-blue-modern-hanbok__walk-runtime.png',base);
const captureOnly=process.argv.includes('--capture-only');
const sheetSha256=sha(await readFile(sheet)),start=Number(process.argv.find(a=>a.startsWith('--start='))?.slice(8)||0);
assert.ok(Number.isInteger(start)&&start>=0&&start<13);
const previous=start||captureOnly?JSON.parse(await readFile(new URL('runtime-map-journey.json',base))):null;
if(previous)assert.equal(previous.sheetSha256,sheetSha256);
const rows=previous?.rows||[];
// Actual UI portals only. Starting at subway-station, return home first so all ten zones are recorded.
const route=[['거리로 나가기','neighborhood'],['집으로 돌아가기','home'],['동네로 나가기','neighborhood'],['지하철역 들어가기','subway-station'],['열차 타기','subway-train'],['예식장역 내리기','venue-exterior'],['예식장 로비 들어가기','lobby'],['신부 대기실','bridal-room'],['로비로 돌아가기','lobby'],['예식홀','ceremony-hall'],['로비로 돌아가기','lobby'],['연회장','banquet'],['화장실','restroom']];
if(!captureOnly)assert.equal(ev('document.querySelector(".world-map__stage")?.dataset.zone'),start?route[start-1][1]:'subway-station');
async function capture(){
 b('wait','--fn','document.querySelector(".virtual-joystick")?.getAttribute("aria-disabled") === "false"');
 const state=ev(`(()=>{const e=document.querySelector('.character-sprite--world'),r=e.getBoundingClientRect(),l=e.querySelector('.character-layer');return{zone:document.querySelector('.world-map__stage').dataset.zone,preset:e.dataset.characterPreset,direction:e.dataset.direction,moving:e.dataset.moving,frame:e.dataset.walkFrame,size:[r.width,r.height],sourceWidth:getComputedStyle(e).getPropertyValue('--character-source-width').trim(),url:l.style.backgroundImage,filter:getComputedStyle(e).filter,position:[parseFloat(e.parentElement.style.left),parseFloat(e.parentElement.style.top)]}})()`);
 assert.deepEqual(state.size,[48,72]);assert.equal(state.sourceWidth,'96px');assert.ok(state.url.includes('guest-12-runtime.png'));assert.notEqual(state.filter,'none');
 const file=`runtime-map-${state.zone}.png`;b('screenshot',fileURLToPath(new URL(file,base)));
 const record={...state,file,sha256:sha(await readFile(new URL(file,base)))};
 const existing=rows.findIndex(r=>r.zone===state.zone);if(existing<0)rows.push(record);else rows[existing]=record;
 assert.equal(sha(await readFile(sheet)),sheetSha256,'Source changed during journey');
 await writeFile(new URL('runtime-map-journey.json',base),JSON.stringify({developmentOnly:true,productionIntegrated:false,characterId:'guest-12',sheetSha256,viewport:[390,844],method:'Accessible portal button activation and in-game pathfinding; no game state or position injection',complete:rows.length===10,rows},null,2)+'\n');
 console.log(state.zone+': actual 96px source / 48x72 display, map CSS filter and screenshot recorded.');
}
await capture();
for(const [label,destination]of captureOnly?[]:route.slice(start)){
 // The map clips distant portals outside the camera. Activate its accessible button,
 // then let the actual game pathfinder walk there; never assign zone or position.
 b('eval',`(()=>{const e=Array.from(document.querySelectorAll('button')).find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)});if(!e)throw Error('Missing portal button');e.click();})()`);
 for(let attempt=0;attempt<100;attempt++){
  const state=ev(`({zone:document.querySelector('.world-map__stage')?.dataset.zone,confirm:Array.from(document.querySelectorAll('button')).some(e=>e.getAttribute('aria-label')===${JSON.stringify(label+' 이동')})})`);
  if(state.zone===destination)break;
  if(state.confirm)b('find','role','button','click','--name',label+' 이동','--exact');
  await new Promise(r=>setTimeout(r,250));
 }
 assert.equal(ev('document.querySelector(".world-map__stage")?.dataset.zone'),destination,'Portal traversal must really reach its destination');
 await capture();
}
assert.equal(rows.length,10);
