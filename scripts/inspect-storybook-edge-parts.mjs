import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {inspectStorybookFrameLayers} from './lib/storybookFrameLayers.mjs';
const [id,direction,frame,coordinates]=process.argv.slice(2);
assert.match(id??'',/^guest-\d{2}$/);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'character-assets/rigs',id,'storybook-source-v1');
console.log(JSON.stringify(await inspectStorybookFrameLayers(base,direction,Number(frame),JSON.parse(coordinates)),null,2));
