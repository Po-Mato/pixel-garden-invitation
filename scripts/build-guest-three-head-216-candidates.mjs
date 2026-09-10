import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
function run(script,...args){
 const result=spawnSync(process.execPath,['scripts/'+script,...args],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
// Candidate inventory only: never substitute legacy art for an unfinished guest.
run('render-guest-three-head-216.mjs');
run('render-guest-three-head-216-profile.mjs','left');
run('render-guest-three-head-216-profile.mjs','right');
run('render-guest-three-head-216-back.mjs');
run('build-guest-three-head-216-review.mjs','guest-03');
for(const id of ['guest-01','guest-02','guest-04','guest-05','guest-06','guest-07','guest-08','guest-09','guest-10','guest-11','guest-12']){
 for(const direction of ['front','left','right','back'])run('render-guest-three-head-216-parts.mjs',id,direction);
 run('build-guest-three-head-216-review.mjs',id);
}
run('guestThreeHead216.test.mjs');
console.log('Twelve 216px candidates rebuilt. Visual review and runtime release are separate gates.');
