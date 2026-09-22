import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
// Rebuild the reviewed painted source recipes. Historical geometric/PNG repair
// pipelines are no longer invoked by normal development or production builds.
// Fail before public asset replacement if source or visual evidence has changed.
for (const script of ['build-storybook-catalog.mjs', 'verify-storybook-release-candidate.mjs']) {
  const result = spawnSync(process.execPath, ['scripts/' + script], {cwd, stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
