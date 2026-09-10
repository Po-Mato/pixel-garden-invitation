import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const productionPreview=process.argv.includes('--production-preview');
const root=new URL('../',import.meta.url),session=productionPreview?'guest216production':'guest216app';
const catalog=JSON.parse(await readFile(new URL('character-assets/rigs/guest-cutout-catalog-v1.json',root)));
const labels=['크림 롱 웨이브 원피스','로즈 여성 한복','네이비 클래식 수트','차콜 클래식 수트','세이지 리본 원피스','샴페인 블라우스 스커트','라벤더 쉬폰 원피스','더스티 로즈 원피스','베이지 썸머 수트','네이비 포멀 원피스','그린 블레이저 크림 팬츠','블루 모던 한복'];
function b(...args){return execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:30000}).trim();}
function ev(code){let r=JSON.parse(b('eval',code));return typeof r==='string'?JSON.parse(r):r;}
const hash=buf=>createHash('sha256').update(buf).digest('hex'),guests=[];
// Reopened dialogs autoplay; establish the neutral state using the real control.
if(ev('JSON.stringify(Array.from(document.querySelectorAll("button")).some(e=>e.getAttribute("aria-label")==="보행 애니메이션 정지"))')) b('find','role','button','click','--name','보행 애니메이션 정지','--exact');
for(const[i,label]of labels.entries()){
 const id='guest-'+String(i+1).padStart(2,'0'),base=new URL(`character-assets/rigs/${id}/three-head-216-v1/review/`,root);
 const preset=catalog.characters.find(c=>c.characterId===id).presetId;
 const expectedUrl=productionPreview?`/characters/generated/guests/preview/${preset}__walk.png?v=guest-soft-tailoring-v1-20260911`:`/__guest216-pilot/${id}.png`;
 b('find','role','button','click','--name',label,'--exact');
 const rows=[];
 for(const[name,direction,row]of [['정면 보기','down',0],['왼쪽 보기','left',1],['오른쪽 보기','right',2],['뒷면 보기','up',3]]){
  b('find','role','button','click','--name',name,'--exact');
  const state=ev('JSON.stringify((()=>{const e=document.querySelector(".character-sprite--preview"),r=e.getBoundingClientRect(),l=e.querySelector(".character-layer");return{...e.dataset,size:[r.width,r.height],url:l.style.backgroundImage,position:l.style.backgroundPosition}})())');
  assert.equal(state.direction,direction);
  // The entry modal uses the same approved visual scale in both build modes.
  const expectedSize=[160,240];
  state.size.forEach((value,index)=>assert.ok(Math.abs(value-expectedSize[index])<0.01));
  // Normal front idle uses its dedicated two-column neutral sheet. The pilot
  // routes deliberately used the walk atlas for every pose.
  const poseUrl=productionPreview&&row===0?expectedUrl.replace('__walk.png','__idle.png'):expectedUrl;
  assert.ok(state.url.includes(poseUrl));
  assert.equal(state.position,productionPreview&&row===0?'0px 0px':`-192px ${row===0?0:-row*288}px`);
  const file=`local-selection-216-${productionPreview?'production-preview-':''}${direction}.png`;b('screenshot',fileURLToPath(new URL(file,base)));
  rows.push({state,file,sha256:hash(await readFile(new URL(file,base)))});
 }
 b('find','role','button','click','--name','보행 애니메이션 재생','--exact');
 const observed=ev('(async()=>{const frames=[];for(let i=0;i<22;i++){frames.push(Number(document.querySelector(".character-sprite--preview").dataset.walkFrame));await new Promise(r=>setTimeout(r,80))}return JSON.stringify(frames)})()');
 assert.deepEqual([...new Set(observed)].sort(),[0,1,2,3]);
 b('find','role','button','click','--name','보행 애니메이션 정지','--exact');
 const stopped=ev('JSON.stringify((()=>{const e=document.querySelector(".character-sprite--preview");return{moving:e.dataset.moving,frame:Number(e.dataset.walkFrame)}})())');
 assert.deepEqual(stopped,{moving:'false',frame:1});
 const response=ev(`(async()=>{const r=await fetch(${JSON.stringify(expectedUrl)}),buf=await r.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',buf);return JSON.stringify({status:r.status,cache:r.headers.get('Cache-Control'),header:r.headers.get('X-Guest216-SHA256'),sha256:Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('')})})()`);
 const local=hash(await readFile(new URL('walk-sheet.png',base)));assert.equal(response.sha256,local);assert.equal(response.status,200);if(!productionPreview){assert.equal(response.header,local);assert.equal(response.cache,'no-store');}
 guests.push({id,label,rows,observed,stopped,response});console.log(id+' actual selection: 4 directions, play/stop and fetched hash verified.');
}
const sw=ev('(async()=>JSON.stringify({controller:!!navigator.serviceWorker.controller,registrations:(await navigator.serviceWorker.getRegistrations()).length}))()');
const previewCssSha256=hash(await readFile(new URL('client/src/entry-screen-v3.css',root)));
await writeFile(new URL(`character-assets/rigs/common-three-head-216-v1/local-selection-${productionPreview?'production-preview-':''}review.json`,root),JSON.stringify({developmentOnly:!productionPreview,productionPreview,productionIntegrated:productionPreview,remoteProductionVerified:false,previewCssSha256,viewport:[390,844],guests,sw,visualReview:'Screenshots captured; separate visual inspection required.'},null,2)+'\n');
