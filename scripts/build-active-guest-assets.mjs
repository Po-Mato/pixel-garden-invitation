import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
// Always rebuild editable originals; the format adapter never patches body pixels.
for (const script of ['build-guest-three-head-216-candidates.mjs', 'export-guest-three-head-216-runtime.mjs']) {
  const result = spawnSync(process.execPath, ['scripts/' + script], {cwd, stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
