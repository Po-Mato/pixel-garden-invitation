import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {guest216MapInputs} from './lib/guest216MapInputs.mjs';
const base=new URL('../character-assets/rigs/common-three-head-216-v1/',import.meta.url);
const b=(...args)=>execFileSync('agent-browser',['--session','guest216finish',...args],{encoding:'utf8',timeout:30000}).trim();
const ev=code=>JSON.parse(JSON.parse(b('eval',`JSON.stringify(${code})`)));
assert.equal(ev('document.body.dataset.audit'),'done','Run the full browser fixture audit first');
const report=ev('window.mapBrowserEvidence');assert.equal(report.rows.length,1920);
async function checkSources(){assert.deepEqual(report.inputs,await guest216MapInputs(),'Map inputs changed; rebuild and rerun the browser fixture');for(const source of report.sourceHashes)assert.equal(createHash('sha256').update(await readFile(new URL(`../${source.id}/three-head-216-v1/review/walk-sheet.png`,base))).digest('hex'),source.sha256,'Browser fixture source changed: '+source.id);}
await checkSources();
const captures=[];
for(const zone of [...new Set(report.rows.map(r=>r.zone))])for(const [direction,name]of [[0,'front'],[1,'left'],[2,'right'],[3,'back']]){
 b('select','#zone',zone);b('select','#direction',String(direction));
 b('wait','--fn','document.body.dataset.ready === "true"');
 const file=`map-browser-${zone}-${name}.png`;b('screenshot',fileURLToPath(new URL(file,base)));
 captures.push({zone,direction,file,sha256:createHash('sha256').update(await readFile(new URL(file,base))).digest('hex')});
}
await checkSources();
await writeFile(new URL('map-browser-evidence.json',base),JSON.stringify({...report,captures,visualReview:'Separate browser composite fixture; each screenshot still needs human visual inspection. Not actual game navigation or production evidence.'},null,2)+'\n');
console.log('1920 browser composite measurements and 40 neutral map/direction screenshots saved.');
