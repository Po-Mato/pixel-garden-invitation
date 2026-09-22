import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {chromium} from 'playwright';
import {createServiceWorkerVariant} from './lib/pwaUpdateRollbackCanary.mjs';
import {verifyStorybookCandidate} from './lib/storybookReleaseCandidate.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'client/dist');
const candidate=await verifyStorybookCandidate(root),assets=new Map();
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const c of candidate.characters){
  // Historical complete-frame fixtures only; no edits to old/new runtime PNGs.
  const oldSheet=await readFile(path.join(root,`character-assets/rigs/${c.characterId}/three-head-216-v1/review/walk-sheet.png`));
  const oldNeutral=await sharp(oldSheet).extract({left:192,top:0,width:192,height:288}).png().toBuffer();
  const oldIdle=await sharp({create:{width:384,height:288,channels:4,background:'#00000000'}}).composite([{input:oldNeutral,left:0,top:0},{input:oldNeutral,left:192,top:0}]).png().toBuffer();
  for(const kind of ['walk','idle'])for(const preview of [false,true]){
    const name=`/characters/generated/guests/${preview?'preview/':''}${c.presetId}__${kind}.png`;
    const high=kind==='walk'?oldSheet:oldIdle;
    const old=preview?high:await sharp(high).resize(kind==='walk'?384:192,kind==='walk'?576:144,{kernel:'nearest'}).png().toBuffer();
    const current=await readFile(path.join(dist,name.slice(1)));
    const approved=c.outputs.find(o=>o.file===`${c.presetId}__${kind}-${preview?'hd':'runtime'}.png`);
    assert.equal(sha(current),approved.sha256);assert.notEqual(sha(old),sha(current));
    assets.set(name,{old,current,oldHash:sha(old),currentHash:sha(current)});
  }
}
const worker=await readFile(path.join(dist,'service-worker.js'),'utf8');
const versions={old:'storybook-cache-old-fixture',current:'storybook-cache-new-fixture'};
const workers=Object.fromEntries(Object.entries(versions).map(([key,version])=>[key,createServiceWorkerVariant(worker,version,[...assets.keys()].map(p=>'.'+p))]));
let phase='old';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  try{
    let bytes;
    if(url.pathname==='/service-worker.js')bytes=workers[phase];
    else if(assets.has(url.pathname))bytes=assets.get(url.pathname)[phase];
    else{const file=path.resolve(dist,relative);assert.ok(file.startsWith(dist+path.sep));bytes=await readFile(file);}
    res.writeHead(200,{'Content-Type':types[path.extname(relative)]||'application/octet-stream','Cache-Control':'no-store','Service-Worker-Allowed':'/'});res.end(bytes);
  }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
const output=path.join(root,'.superpowers/visual-regression/storybook-asset-cache-update');
try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),page=await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const waitForAsync=async(predicate,arg)=>{
    const deadline=Date.now()+60000;
    while(Date.now()<deadline){if(await page.evaluate(predicate,arg))return;await page.waitForTimeout(150);}
    throw Error('Timed out waiting for verified service-worker/cache state');
  };
  const ready=version=>waitForAsync(async({version,paths})=>{
    if(!navigator.serviceWorker.controller)return false;
    const names=await caches.keys(),name=`wedding-garden-precache-${version}`;
    if(!names.includes(name))return false;
    const cache=await caches.open(name);return (await Promise.all(paths.map(p=>cache.match(new URL(p,location.href))))).every(Boolean);
  },{version,paths:[...assets.keys()]});
  const readHashes=()=>page.evaluate(async entries=>Promise.all(entries.map(async({url,expected})=>{
    // The production worker intentionally caches image requests, not arbitrary
    // fetch() calls. Exercise that exact offline image path and decoded pixels.
    const image=new Image();image.src=url;try{await image.decode();}catch(error){throw Error('Offline image decode failed: '+url+' '+error.message);}
    const reference=new Image();reference.src='data:image/png;base64,'+expected;try{await reference.decode();}catch(error){throw Error('Reference decode failed: '+url+' '+error.message);}
    const pixels=i=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,c.width,c.height).data;};
    const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(await hash(pixels(image))!==await hash(pixels(reference)))throw Error('Stale decoded image: '+url);
    const response=await caches.match(new URL(url,location.href));if(!response?.ok)throw Error('No cached image: '+url);
    return {url,sha256:await hash(await response.arrayBuffer()),offlineImageDecoded:true};
  })),[...assets].map(([url,a])=>({url,expected:a[phase].toString('base64')})));
  await ready(versions.old);
  await context.setOffline(true);
  const previous=await readHashes();for(const a of previous)assert.equal(a.sha256,assets.get(a.url).oldHash);
  await context.setOffline(false);phase='current';
  await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
  await waitForAsync(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
  await page.evaluate(async()=>{(await navigator.serviceWorker.getRegistration()).waiting.postMessage({type:'SKIP_WAITING'});});
  await ready(versions.current);
  await waitForAsync(async()=>!(await caches.keys()).some(n=>n.includes('storybook-cache-old-fixture')));
  await context.setOffline(true);
  const current=await readHashes();for(const a of current)assert.equal(a.sha256,assets.get(a.url).currentHash);
  await mkdir(output,{recursive:true});
  const report={scope:'Local built-service-worker cache transition with historical complete-frame fixtures and 48 explicitly warmed URLs; not a deployed-site claim',passed:true,viewport:[390,844],previousAssets:previous.length,updatedOfflineAssets:current.length,staleAssets:0,oldVersionCachesRemoved:true,versions,previous,current};
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:true,previousAssets:previous.length,updatedOfflineAssets:current.length,staleAssets:0,report:path.relative(root,path.join(output,'report.json'))}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
