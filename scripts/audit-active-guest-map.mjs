import {access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {storybookStagingDirectory,verifyStorybookCandidate} from './lib/storybookReleaseCandidate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// A clean checkout has no generated staging. Build editable originals once,
// then require current source/evidence hashes; never substitute legacy sprites.
try{await access(path.join(root,storybookStagingDirectory,'build-manifest.json'));}
catch(error){if(error.code!=='ENOENT')throw error;execFileSync(process.execPath,['scripts/build-active-guest-assets.mjs'],{cwd:root,stdio:'inherit'});}
await verifyStorybookCandidate(root);
execFileSync(process.execPath,['scripts/audit-storybook-map-evidence.mjs'],{cwd:root,stdio:'inherit'});
