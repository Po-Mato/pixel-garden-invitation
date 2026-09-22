import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildAnchor} from './build-storybook-anchor.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(await fs.readFile(path.join(root,'character-assets/rigs/guest-cutout-catalog-v1.json')));
assert.equal(catalog.characters.length,12);
assert.equal(new Set(catalog.characters.map(c=>c.characterId)).size,12);
assert.equal(catalog.characters.filter(c=>c.characterId==='guest-05').length,1);
for(const {characterId} of catalog.characters){
  assert.match(characterId,/^guest-\d{2}$/);
  if(characterId==='guest-05')await buildAnchor();
  else for(const script of ['render-storybook-head-study.mjs','render-storybook-body-study.mjs','render-storybook-walk-study.mjs']){
    execFileSync(process.execPath,[path.join(root,'scripts',script),characterId],{cwd:root,stdio:'inherit'});
  }
  if(characterId==='guest-01'){
    const recipe=JSON.parse(await fs.readFile(path.join(root,'character-assets/rigs/guest-01/storybook-source-v1/active-source-recipe.json')));
    assert.equal(recipe.renderer,'guest01-balanced-source-v3');assert.equal(recipe.scope,'staging-only');
    execFileSync(process.execPath,[path.join(root,'scripts/render-guest01-balanced-directions.mjs'),'balanced-shading-v3','--canonical'],{cwd:root,stdio:'inherit'});
  }
}
// This exporter only writes character-assets/generated staging. It does not
// replace public assets, set approvals, deploy, or invoke legacy PNG repair.
execFileSync(process.execPath,[path.join(root,'scripts/export-storybook-runtime-staging.mjs')],{cwd:root,stdio:'inherit'});
