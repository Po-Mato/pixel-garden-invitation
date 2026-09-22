import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {inspectStorybookFrameLayers} from './lib/storybookFrameLayers.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs/storybook-expansion-v1');
const evidence=JSON.parse(await readFile(path.join(base,'map-browser-evidence.json'),'utf8'));
const selected=process.argv[2];
if(selected&&!/^guest-(0[1-9]|1[0-2])$/.test(selected))throw Error('Choose guest-01 through guest-12');
const samples=selected?evidence.belowStandardThreshold.filter(r=>r.id===selected):evidence.belowDisplayThreshold;
const output=path.join(base,selected?`basic-failure-diagnosis-${selected}-v1`:'display-failure-diagnosis-v1');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--allow-file-access-from-files']});
const rows=[];
try{
  const page=await browser.newPage();
  await page.goto(pathToFileURL(path.join(base,'map-browser-review.html')).href);
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
  for(const sample of samples){
    const result=await page.evaluate(async sample=>{const z=DATA.zones.find(z=>z.id===sample.zone),c=DATA.characters.find(c=>c.id===sample.id);const r=await render(z,c,sample.direction,sample.frame);return {edgeContrast:r.edgeContrast,displayEdgeContrasts:r.displayEdgeContrasts,edgeSamples:r.edgeSamples,scene:r.canvas.toDataURL('image/png'),sourceUrl:new URL(c.url,location.href).href};},sample);
    const sourcePath=fileURLToPath(result.sourceUrl);
    const sha256=createHash('sha256').update(await readFile(sourcePath)).digest('hex');
    if(evidence.sourceHashes.find(s=>s.id===sample.id)?.sha256!==sha256)throw Error('Stale source');
    const weak=result.edgeSamples.filter(p=>p.value<1.17);
    const direction=['front','left','right','back'][sample.direction];
    const source=await inspectStorybookFrameLayers(path.join(root,'character-assets/rigs',sample.id,sample.id==='guest-05'?'storybook-directions-v1':'storybook-source-v1'),direction,sample.frame+1,weak.map(p=>[p.x,p.y]));
    const filename=`${sample.id}-${sample.zone}-${direction}-${sample.frame}.png`;
    await writeFile(path.join(output,filename),Buffer.from(result.scene.split(',')[1],'base64'));
    const owners={};
    for(const p of source.ownership)owners[p.dominant]=(owners[p.dominant]??0)+1;
    rows.push({...sample,currentEdgeContrast:result.edgeContrast,currentDisplayContrasts:result.displayEdgeContrasts,sha256,filename,weakEdgeCount:weak.length,totalEdgeCount:result.edgeSamples.length,owners,source,weakEdges:weak});
    console.log(sample.id,direction,sample.frame,owners);
  }
  await writeFile(path.join(output,'evidence.json'),JSON.stringify({scope:`Read-only diagnosis of ${samples.length} ${selected?'basic':'display-profile'} failures; source alpha attribution is approximate`,sourceChanged:false,thresholdsUnchanged:true,visualApproved:false,rows},null,2)+'\n');
}finally{await browser.close();}
