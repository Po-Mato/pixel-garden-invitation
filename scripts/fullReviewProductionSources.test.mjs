import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyFullReviewProductionSources,fullReviewDirectory} from './lib/fullReviewProductionSources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('production package matches its reviewed evidence and all source/output hashes',async()=>{
 const manifest=await verifyFullReviewProductionSources(root);
 assert.equal(manifest.characters.length,12);
});
test('package cannot be promoted with absent approval or evidence bound to another manifest',async()=>{
 const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'full-review-proof-'));
 try{
  const base=path.join(fixture,fullReviewDirectory);await fs.mkdir(base,{recursive:true});
  await fs.writeFile(path.join(base,'build-manifest.json'),'{}');
  await assert.rejects(verifyFullReviewProductionSources(fixture),{code:'ENOENT'});
  await fs.writeFile(path.join(base,'production-review.json'),JSON.stringify({version:1,pipeline:'full-review-v1',authorization:'user-requested-production-deployment',manifestSha256:'0'.repeat(64)}));
  await assert.rejects(verifyFullReviewProductionSources(fixture),/Review must bind the exact package/);
 }finally{await fs.rm(fixture,{recursive:true,force:true});}
});
