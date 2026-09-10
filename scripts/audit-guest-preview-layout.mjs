import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('character-assets/rigs/guest-cutout-catalog-v1.json',root)));
const b=(...args)=>execFileSync('agent-browser',['--session','previewlayout2',...args],{encoding:'utf8',timeout:30000}).trim();
const ev=code=>JSON.parse(JSON.parse(b('eval',`JSON.stringify(${code})`)));
const rows=[];
// Start with the actual selection dialog open; no sprite styles or game state injection.
for(const [width,height,expectedWidth,expectedHeight]of [[390,844,160,240],[375,667,128,192],[320,568,128,192],[320,741,128,192],[320,801,160,240]]){
 b('set','viewport',String(width),String(height));
 for(const c of catalog.characters){
  b('find','role','button','click','--name',c.label,'--exact');
  for(const label of ['정면 보기','왼쪽 보기','오른쪽 보기','뒷면 보기']){
   b('find','role','button','click','--name',label,'--exact');
   const r=ev(`(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();return{frame:rect('.character-sprite--preview'),stage:rect('.character-customizer__preview'),halo:rect('.character-customizer__halo'),dots:rect('.character-customizer__direction-dots'),controls:rect('.character-customizer__preview-controls'),pageOverflow:document.documentElement.scrollWidth>innerWidth}})()`);
   assert.ok(Math.abs(r.frame.width-expectedWidth)<.01);assert.ok(Math.abs(r.frame.height-expectedHeight)<.01);
   assert.ok(Math.abs(r.frame.x+r.frame.width/2-r.stage.x-r.stage.width/2)<.01,'shared horizontal centre');
   const feet=r.frame.y+r.frame.height*270/288,head=r.frame.y+r.frame.height*54/288;
   assert.ok(Math.abs(feet-r.halo.y-r.halo.height/2)<.01,'shared foot line and shadow');
   assert.ok(head>=r.dots.bottom,'head does not overlap direction buttons');
   assert.ok(feet<r.controls.top,'feet do not overlap playback controls');
   assert.equal(r.pageOverflow,false);rows.push({id:c.characterId,viewport:[width,height],direction:label,...r});
  }
 }
}
b('set','viewport','390','844');
b('set','media','light','reduced-motion');
const reduced=ev(`(()=>{const r=document.querySelector('.character-sprite--preview').getBoundingClientRect();return{width:r.width,height:r.height,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}})()`);
assert.equal(reduced.reduced,true);assert.ok(Math.abs(reduced.width-160)<.01);assert.ok(Math.abs(reduced.height-240)<.01);
b('set','media','light');
b('find','role','button','click','--name','보행 애니메이션 재생','--exact');
const animation=JSON.parse(JSON.parse(b('eval',`(async()=>{const rows=[];for(let n=0;n<16;n++){const e=document.querySelector('.character-sprite--preview'),r=e.getBoundingClientRect();rows.push({width:r.width,height:r.height,x:r.x,y:r.y,frame:e.dataset.walkFrame});await new Promise(resolve=>setTimeout(resolve,80));}return JSON.stringify(rows)})()`)));
assert.deepEqual([...new Set(animation.map(r=>r.frame))].sort(),['0','1','2','3']);
for(const r of animation){assert.ok(Math.abs(r.width-160)<.01);assert.ok(Math.abs(r.height-240)<.01);assert.equal(r.x,animation[0].x);assert.equal(r.y,animation[0].y);}
b('find','role','button','click','--name','보행 애니메이션 정지','--exact');
const out=new URL('.superpowers/visual-regression/guest-preview-layout.json',root);await mkdir(new URL('./',out),{recursive:true});
await writeFile(out,JSON.stringify({rows,reduced,animation,scope:'Local selection layout only; not deployment or anatomy approval'},null,2)+'\n');
console.log(`${rows.length} selection layouts, fixed foot/centre, reduced-motion and walking geometry passed.`);
