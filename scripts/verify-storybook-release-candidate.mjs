import {fileURLToPath} from 'node:url';
import {verifyStorybookCandidate} from './lib/storybookReleaseCandidate.mjs';
const candidate=await verifyStorybookCandidate(fileURLToPath(new URL('../',import.meta.url)));
console.log(JSON.stringify({characters:candidate.characters.length,reviewedSourceAndEvidenceMatch:true,scope:'Local source-bound candidate; this is not deployment or production service-worker verification.'}));
