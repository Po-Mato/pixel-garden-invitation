import {access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const coupleStyleDirectory="character-assets/generated/couple-style-v1";
import {verifyCoupleStyleProductionSources} from './lib/coupleStyleProductionSources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// Check approved current sources; historical storybook evidence remains isolated.
try{await access(path.join(root,coupleStyleDirectory,'build-manifest.json'));}
catch(error){if(error.code!=='ENOENT')throw error;execFileSync(process.execPath,['scripts/build-active-guest-assets.mjs'],{cwd:root,stdio:'inherit'});}
await verifyCoupleStyleProductionSources(root);
execFileSync(process.execPath,['scripts/audit-couple-style-map-composites.mjs'],{cwd:root,stdio:'inherit'});
