import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {mapToneCharacterPositions,displayCalibrationProfiles} from './lib/mapToneAudit.mjs';
import {DEFAULT_FOREGROUND_PLACEMENTS} from './lib/mapForegroundAuditRenderer.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const variant=process.argv[2]||'balanced-arms-four-direction-v2';
if(!['balanced-arms-four-direction-v2','balanced-shading-v3'].includes(variant))throw Error('Unknown candidate');
const out=path.join(root,'character-assets/rigs/guest-01/storybook-source-v1/review',variant);
const json=async f=>JSON.parse(await fs.readFile(path.join(root,f)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const maps=await json('map-assets/reference/v2/manifest.json');
const css=await fs.readFile(path.join(root,'client/src/map-visual-enhancements.css'),'utf8');
const url=f=>pathToFileURL(path.join(root,f)).href;
const zones=maps.zones.map(z=>{
 const block=css.match(new RegExp(`\\.world-map__stage\\[data-zone="${z.id}"\\]\\s*\\{([^}]+)`))?.[1];
 const shadow=block?.match(/--character-edge-shadow:\s*([^;]+)/)?.[1],tone=block?.match(/--character-tone-filter:\s*([^;]+)/)?.[1];
 if(!shadow||!tone)throw Error('Missing map CSS '+z.id);
 return {id:z.id,position:mapToneCharacterPositions[z.id],filter:`${tone} drop-shadow(0 1px 0 ${shadow}) drop-shadow(1px 2px 0 ${shadow})`,background:url(`client/public/assets/maps/v2/${z.id}/${z.background.output}`),foreground:(DEFAULT_FOREGROUND_PLACEMENTS[z.id]||[]).map(p=>({...p,url:url(`client/public/assets/maps/v2/${z.id}/${p.asset}`)}))};
});
const characters=await Promise.all([
 ['guest01-baseline','character-assets/generated/storybook-runtime-staging-v1/feminine-long-wave-dress/feminine-long-wave-dress__walk-runtime.png'],
 ['guest01-approved',path.relative(root,path.join(out,'walk-runtime.png'))]
].map(async([id,file])=>({id,url:url(file),sha256:hash(await fs.readFile(path.join(root,file)))})));
const inputs=await Promise.all(['scripts/templates/storybook-map-review.js','scripts/visual-baselines/map-tone-contract.json','scripts/audit-guest01-balanced-maps.mjs',...zones.flatMap(z=>[fileURLToPath(z.background),...z.foreground.map(p=>fileURLToPath(p.url))])].map(async file=>({file:path.isAbsolute(file)?path.relative(root,file):file,sha256:hash(await fs.readFile(path.resolve(root,file)))})));
const data={zones,characters,thresholds:(await json('scripts/visual-baselines/map-tone-contract.json')).thresholds,inputs,cssSha256:hash(css)};
const profiles='const DISPLAY_PROFILES={'+Object.entries(displayCalibrationProfiles).map(([id,p])=>JSON.stringify(id)+':'+p.adjustLuminance.toString().replace(/^adjustLuminance/,'function')).join(',')+'};';
const script=profiles+await fs.readFile(path.join(root,'scripts/templates/storybook-map-review.js'),'utf8');
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>1번 승인본 맵 대비</title><style>body{font:15px system-ui;background:#eee8df;margin:16px}select,button{padding:8px;margin:3px}#grid{display:flex;gap:16px}figure{margin:0}canvas{width:84px;height:104px}figcaption{font-size:12px}#status{white-space:pre-wrap}</style><h1>1번 기존 / 승인본</h1><p>동일 맵 위치 · 48×72 · 기존 판정 기준 유지</p><select id="zone" aria-label="맵"></select><select id="direction" aria-label="방향"><option value="0">정면</option><option value="1">왼쪽</option><option value="2">오른쪽</option><option value="3">후면</option></select><select id="frame" aria-label="프레임"><option value="1">중립 2</option><option value="0">보행 1</option><option value="2">보행 3</option><option value="3">중립 4</option></select><button id="audit">전체 대비 검사</button><p id="status"></p><div id="grid"></div><script>const DATA=${JSON.stringify(data)};${script.replace("'1920개 합성 검사 · 기본 미달 '","'비교 합성 검사 · 기본 미달 '")}</script></html>`;
await fs.writeFile(path.join(out,'map-review.html'),html);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--allow-file-access-from-files']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(pathToFileURL(path.join(out,'map-review.html')).href);
 await page.waitForFunction(()=>document.body.dataset.ready==='true');
 await page.locator('#audit').click();await page.waitForFunction(()=>document.body.dataset.audit==='done',null,{timeout:60000});
 const evidence=await page.evaluate(()=>window.mapBrowserEvidence);
 await fs.writeFile(path.join(out,'map-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 const summary=characters.map(c=>({id:c.id,samples:evidence.rows.filter(r=>r.id===c.id).length,standardFailures:evidence.belowStandardThreshold.filter(r=>r.id===c.id).length,displayFailures:evidence.belowDisplayThreshold.filter(r=>r.id===c.id).length}));
 const candidate=summary.find(c=>c.id==='guest01-approved');
 const gate={scope:'guest01-approved-only',shapeApprovedByUser:true,releaseEligible:candidate.standardFailures===0&&candidate.displayFailures===0,summary,thresholds:data.thresholds,sourceHashes:evidence.sourceHashes,productionChanged:false};
 await fs.writeFile(path.join(out,'release-gate.json'),JSON.stringify(gate,null,2)+'\n');
 console.log(JSON.stringify(gate,null,2));
 // Save every map/direction for a human visual pass, not just failed samples.
 for(const z of zones)for(let d=0;d<4;d++){
   await page.selectOption('#zone',z.id);await page.selectOption('#direction',String(d));await page.selectOption('#frame','0');await page.waitForFunction(()=>document.body.dataset.ready==='true');
   await page.screenshot({path:path.join(out,`map-${z.id}-${d}.png`)});
 }
 if(!gate.releaseEligible)process.exitCode=1;
}finally{await browser.close();}
