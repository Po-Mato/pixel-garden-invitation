import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapToneCharacterPositions,displayCalibrationProfiles} from './lib/mapToneAudit.mjs';
import {DEFAULT_FOREGROUND_PLACEMENTS} from './lib/mapForegroundAuditRenderer.mjs';
import {guest216MapInputs} from './lib/guest216MapInputs.mjs';
const root=new URL('../',import.meta.url);
const json=async p=>JSON.parse(await readFile(new URL(p,root)));
const catalog=await json('character-assets/rigs/guest-cutout-catalog-v1.json');
const maps=await json('map-assets/reference/v2/manifest.json');
const css=await readFile(new URL('client/src/map-visual-enhancements.css',root),'utf8');
const zones=maps.zones.map(z=>{
 const block=css.match(new RegExp(`\\.world-map__stage\\[data-zone="${z.id}"\\]\\s*\\{([^}]+)`))?.[1];
 const shadow=block?.match(/--character-edge-shadow:\s*([^;]+)/)?.[1];
 const tone=block?.match(/--character-tone-filter:\s*([^;]+)/)?.[1];
 if(!shadow||!tone)throw Error('Missing map CSS: '+z.id);
 return {id:z.id,position:mapToneCharacterPositions[z.id],filter:`${tone} drop-shadow(0 1px 0 ${shadow}) drop-shadow(1px 2px 0 ${shadow})`,background:new URL(`client/public/assets/maps/v2/${z.id}/${z.background.output}`,root).href,foreground:(DEFAULT_FOREGROUND_PLACEMENTS[z.id]||[]).map(p=>({...p,url:new URL(`client/public/assets/maps/v2/${z.id}/${p.asset}`,root).href}))};
});
if(!css.includes('drop-shadow(0 1px 0 var(--character-edge-shadow))\n    drop-shadow(1px 2px 0 var(--character-edge-shadow))'))throw Error('Runtime filter chain changed; review must be updated.');
const characters=await Promise.all(catalog.characters.map(async c=>{
 const url=new URL(`character-assets/rigs/${c.characterId}/three-head-216-v1/review/walk-sheet.png`,root);
 return {id:c.characterId,label:c.label,url:url.href,sha256:createHash('sha256').update(await readFile(url)).digest('hex')};
}));
const contract=await json('scripts/visual-baselines/map-tone-contract.json');
const data={zones,characters,thresholds:contract.thresholds,inputs:await guest216MapInputs(root),cssSha256:createHash('sha256').update(css).digest('hex')};
const profiles='const DISPLAY_PROFILES={'+Object.entries(displayCalibrationProfiles).map(([id,p])=>JSON.stringify(id)+':'+p.adjustLuminance.toString().replace(/^adjustLuminance/,'function')).join(',')+'};';
const script=profiles+await readFile(new URL('scripts/templates/guest216-map-review.js',root),'utf8');
await writeFile(new URL('character-assets/rigs/common-three-head-216-v1/map-browser-review.html',root),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>216px 맵 대비 대조</title><style>body{margin:12px;font:14px system-ui;background:#eee8df;color:#26334a}h1{font-size:19px}select,button{font:inherit;padding:8px;margin:3px}#grid{display:grid;grid-template-columns:repeat(4,84px);gap:7px}figure{margin:0}canvas{display:block;width:84px;height:104px}figcaption{font-size:11px;line-height:16px}#status{white-space:pre-wrap}</style><h1>216px · 맵 대비 대조</h1><p>실제 맵 위치·전경 + 브라우저 색상/외곽 필터.<br>별도 검수 도구이며 실제 게임 UI 검증을 대체하지 않음.</p><select id="zone" aria-label="맵"></select><select id="direction" aria-label="방향"><option value="0">정면</option><option value="1">왼쪽</option><option value="2">오른쪽</option><option value="3">후면</option></select><select id="frame" aria-label="프레임"><option value="1">중립 2</option><option value="0">보행 1</option><option value="2">보행 3</option><option value="3">중립 4</option></select><button id="audit">전체 대비 검사</button><p id="status">로딩 중</p><div id="grid"></div><script>const DATA=${JSON.stringify(data)};${script}</script></html>`);
console.log('Browser map fixture generated; production and canonical contrast baseline unchanged.');
