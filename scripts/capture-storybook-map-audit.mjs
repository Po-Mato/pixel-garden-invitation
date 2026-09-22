import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--allow-file-access-from-files']});
try{
  const page=await browser.newPage();
  await page.goto(pathToFileURL(path.join(root,'character-assets/rigs/storybook-expansion-v1/map-browser-review.html')).href);
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
  await page.locator('#audit').click();
  await page.waitForFunction(()=>document.body.dataset.audit==='done',null,{timeout:60000});
  const evidence=await page.evaluate(()=>window.mapBrowserEvidence);
  const output=process.argv.includes('--candidate')?'map-browser-candidate-evidence.json':'map-browser-evidence.json';
  await writeFile(path.join(root,'character-assets/rigs/storybook-expansion-v1',output),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({output,samples:evidence.rows.length,standardFailures:evidence.belowStandardThreshold.length,displayFailures:evidence.belowDisplayThreshold.length}));
}finally{await browser.close();}
