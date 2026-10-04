import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyCoupleStyleProductionSources} from './lib/coupleStyleProductionSources.mjs';
import {verifyFullReviewProductionSources} from './lib/fullReviewProductionSources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// Rebuild approved sources, then bind fresh outputs to immutable review evidence.
for(const script of ['render-hanbok-front-rig-v10.mjs','build-full-character-review.mjs','normalize-couple-style-sources.mjs','build-couple-style-pilot.mjs']){
 const result=spawnSync(process.execPath,['scripts/'+script],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
await verifyFullReviewProductionSources(root);
await verifyCoupleStyleProductionSources(root);
console.log('Verified historical full-review-v1 and current couple-style-v1 release integrity.');
