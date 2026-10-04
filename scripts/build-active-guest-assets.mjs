import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyFullReviewProductionSources} from './lib/fullReviewProductionSources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// Rebuild approved sources, then bind fresh outputs to immutable review evidence.
for(const script of ['render-hanbok-front-rig-v10.mjs','build-full-character-review.mjs']){
 const result=spawnSync(process.execPath,['scripts/'+script],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
await verifyFullReviewProductionSources(root);
console.log('Verified reviewed full-review-v1 source, evidence, and output integrity.');
