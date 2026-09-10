import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const session='guest216finish';
// Installed agent-browser 0.13 has no batch command. Keep sequential CLI calls.
function browser(...args){return execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:30000}).trim();}
function evaluate(code){const result=JSON.parse(browser('eval',code));return typeof result==='string'?JSON.parse(result):result;}
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const id of process.argv.slice(2)){
 assert.match(id,/^guest-(0[1-9]|1[0-2])$/);
 const base=new URL(`../character-assets/rigs/${id}/three-head-216-v1/review/`,import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',base)));
 browser('--allow-file-access','open',new URL('interactive.html',base).href);
 browser('set','viewport','390','844');
 browser('snapshot','-i');
 const dimensions=evaluate('JSON.stringify({viewport:[innerWidth,innerHeight],horizontalOverflow:document.documentElement.scrollWidth>innerWidth,displaySizes:["hd","selection","game"].map(id=>{const b=document.getElementById(id).getBoundingClientRect();return[b.width,b.height]})})');
 assert.deepEqual(dimensions.viewport,[390,844]);assert.equal(dimensions.horizontalOverflow,false);
 browser('click','#play');
 const observedFrames=evaluate('(async()=>{const frames=[];for(let i=0;i<16;i++){frames.push(Number(document.body.dataset.frame));await new Promise(r=>setTimeout(r,80))}return JSON.stringify(frames)})()');
 assert.deepEqual([...new Set(observedFrames)].sort(),[1,2,3,4]);
 browser('click','#stop');
 const stopBeforeAfter400ms=evaluate('(async()=>{const a=Number(document.body.dataset.frame);await new Promise(r=>setTimeout(r,400));return JSON.stringify([a,Number(document.body.dataset.frame)])})()');
 assert.deepEqual(stopBeforeAfter400ms,[2,2]);
 const screenshots=[];
 for(const d of ['front','left','right','back']){
  browser('select','#direction',d);browser('click','#stop');
  for(const[name,step,dark]of [['neutral',2,false],['step1-dark',1,true],['step3-dark',3,true]]){
   const isDark=evaluate('JSON.stringify(document.body.classList.contains("dark"))');if(isDark!==dark)browser('click','#dark');
   browser('click',`[data-step="${step}"]`);
   browser('wait','--fn','Array.from(document.images).every(i=>i.complete&&i.naturalWidth===192)');
   const file=`mobile-${d}-${name}.png`,target=fileURLToPath(new URL(file,base));browser('screenshot',target);
   screenshots.push({file,sha256:hash(await readFile(target))});
  }
 }
 const proof={...dimensions,observedFrames,stopBeforeAfter400ms,screenshots,frameSources:manifest.sources,sheetSha256:manifest.sheetSha256,runtimeIntegrated:false,visualReview:'Captured browser evidence; human-like visual inspection is a separate pending gate, not inferred from these assertions.'};
 assert.equal(hash(await readFile(new URL('walk-sheet.png',base))),manifest.sheetSha256);
 await writeFile(new URL('browser-review.json',base),JSON.stringify(proof,null,2)+'\n');
 console.log(id+': 12 mobile screenshots and real play/stop measurements captured.');
}
