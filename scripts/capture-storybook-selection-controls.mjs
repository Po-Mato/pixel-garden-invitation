import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'character-assets/rigs/storybook-expansion-v1/client-selection-controls-v1');
await mkdir(output,{recursive:true});
const catalog=JSON.parse(await readFile(path.join(root,'character-assets/rigs/guest-cutout-catalog-v1.json'))).characters;
const presets=JSON.parse(await readFile(path.join(root,'character-assets/guest-character-presets.json'))).presets;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const rows=[];
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto('http://127.0.0.1:4197/');
  await page.getByRole('button',{name:/입장 캐릭터/}).click();
  const sprite=page.locator('.character-sprite--preview');
  const state=()=>sprite.evaluate(e=>({preset:e.dataset.characterPreset,direction:e.dataset.direction,moving:e.dataset.moving,frame:e.dataset.walkFrame,url:e.querySelector('img').src,rect:e.getBoundingClientRect().toJSON()}));
  for(const c of catalog){
    await page.getByRole('button',{name:presets.find(p=>p.id===c.presetId).label,exact:true}).click();
    await page.getByRole('button',{name:'보행 애니메이션 정지',exact:true}).click();
    const stopped=[];
    for(const [direction,label] of [['down','정면 보기'],['left','왼쪽 보기'],['right','오른쪽 보기'],['up','뒷면 보기']]){
      await page.getByRole('button',{name:label,exact:true}).click();
      await sprite.locator('img').evaluate(i=>i.decode());
      const before=await state();await page.waitForTimeout(300);const after=await state();
      assert.equal(before.preset,c.presetId);assert.equal(after.direction,direction);
      assert.equal(before.moving,'false');assert.equal(after.moving,'false');assert.equal(before.frame,after.frame);
      assert.equal(await page.getByRole('button',{name:'보행 애니메이션 재생',exact:true}).getAttribute('aria-pressed'),'false');
      stopped.push({direction,before,after});
    }
    await page.getByRole('button',{name:'보행 애니메이션 재생',exact:true}).click();
    const frames=await sprite.evaluate(async e=>{const frames=new Set();const start=performance.now();while(performance.now()-start<1200){frames.add(e.dataset.walkFrame);await new Promise(requestAnimationFrame);}return [...frames].sort();});
    assert.deepEqual(frames,['0','1','2','3']);assert.equal((await state()).moving,'true');
    rows.push({id:c.characterId,stopped,resumedFrames:frames});
    console.log(`${c.characterId}: pause, four directions and resume verified`);
  }
  await writeFile(path.join(output,'evidence.json'),JSON.stringify({viewport:[390,844],characters:12,pausedDirections:48,rows,passed:true,visualApproved:false,productionServiceWorkerChecked:false},null,2)+'\n');
}finally{await browser.close();}
