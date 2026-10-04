import {access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fullReviewDirectory,verifyFullReviewProductionSources} from './lib/fullReviewProductionSources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// Check approved current sources; historical storybook evidence remains isolated.
try{await access(path.join(root,fullReviewDirectory,'build-manifest.json'));}
catch(error){if(error.code!=='ENOENT')throw error;execFileSync(process.execPath,['scripts/build-active-guest-assets.mjs'],{cwd:root,stdio:'inherit'});}
await verifyFullReviewProductionSources(root);
execFileSync(process.execPath,['scripts/audit-full-review-map-composites.mjs'],{cwd:root,stdio:'inherit'});
