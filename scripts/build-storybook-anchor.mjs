import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {beginPaintedRender, finishPaintedRender} from './lib/paintedRenderReceipt.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const anchor=path.join(root,'character-assets/rigs/guest-05');
const body=path.join(anchor,'storybook-body-v1');
const heads=path.join(anchor,'storybook-head-matte-v1');
const directions=path.join(anchor,'storybook-directions-v1');
const common=path.join(root,'character-assets/rigs/common-three-head-216-v1');
const scripts=[
  'render-storybook-head-matte.mjs','render-storybook-head-layers.mjs',
  'render-storybook-hidden-forehead.mjs','render-storybook-hidden-back-hair.mjs',
  'render-storybook-front-neutral.mjs','render-storybook-front-walk.mjs',
  'render-storybook-direction-heads.mjs','render-storybook-direction-bodies.mjs',
  'render-storybook-direction-walk.mjs'
];
const json=async file=>JSON.parse(await fs.readFile(file));

// Enumerate actual editable inputs, never accept an old generated head/limb as
// an independent source. Every intermediate is rebuilt in dependency order.
export async function anchorInputs(){
  const front=await json(path.join(body,'front-registration.json'));
  const profile=await json(path.join(directions,'body-registration.json'));
  const head=await json(path.join(directions,'head-registration.json'));
  const layers=await json(path.join(directions,'head-layers.json'));
  return [...new Set([
    'pnpm-lock.yaml','scripts/build-storybook-anchor.mjs',
    'scripts/lib/paintedRenderReceipt.mjs','scripts/lib/packCharacterFrames.mjs',
    'scripts/render-storybook-direction-head-layers.mjs',
    'scripts/lib/paintedHeadMaterial.mjs','scripts/lib/paintedSourceOverlay.mjs',
    ...scripts.map(s=>'scripts/'+s),
    path.join(common,'skeleton.json'),
    ...['front','left','right','back'].map(d=>path.join(common,`animations/dress-${d}.json`)),
    path.join(common,'animations/painted-dress-contact-v1.json'),
    path.join(anchor,'storybook-concept-v1/front-concept.png'),
    path.join(anchor,'storybook-head-study-v1/front-head-candidate.png'),
    ...['head-matte-refined.svg','head-registration.json','head-layers.json',
      'hidden-forehead-matte.svg','hidden-back-hair-matte.svg',
      'sources/hidden-forehead-paint-v1.png','sources/hidden-back-hair-paint-v1.png'].map(f=>path.join(heads,f)),
    ...['front-registration.json','front-joint-bindings.json','neck-front.svg'].map(f=>path.join(body,f)),
    path.resolve(body,front.skeleton),path.resolve(body,front.shadow.source),
    ...front.parts.flatMap(p=>[
      path.join(body,`sources/${p.id}-front-${p.version||'v1'}.png`),
      path.join(body,`masks/${p.id}-front-${p.version||'v1'}.svg`)
    ]),
    ...['body-registration.json','head-registration.json','head-layers.json','neck-skin.svg'].map(f=>path.join(directions,f)),
    path.resolve(directions,profile.skeleton),path.resolve(directions,profile.shadow.source),
    ...profile.parts.flatMap(p=>[
      path.join(directions,`sources/${p.source||p.id}-v1.png`),
      path.join(directions,`masks/${p.source||p.id}-v1.svg`),
      ...(p.sourceOverlays||[]).map(f=>path.resolve(directions,f))
    ]),
    ...head.heads.flatMap(p=>[path.resolve(directions,p.source),path.resolve(directions,p.matte)]),
    ...Object.entries(layers.directions).flatMap(([d,p])=>[
      path.join(directions,`sources/head-${d}-v1.png`),path.join(directions,`masks/head-${d}-v1.svg`),
      ...(p.sourceOverlays||[]).map(f=>path.resolve(directions,f)),
      ...(p.hiddenSurfaces||[]).flatMap(s=>[path.resolve(directions,s.source),path.resolve(directions,s.matte)])
    ])
  ].map(f=>path.resolve(root,f)))].sort();
}

export async function buildAnchor(){
  const receipt=await beginPaintedRender(root,await anchorInputs());
  for(const script of scripts)execFileSync(process.execPath,[path.join(root,'scripts',script)],{cwd:root,stdio:'pipe'});
  const out=path.join(directions,'generated');
  await finishPaintedRender(root,path.join(out,'walk-render-receipt.json'),receipt,[
    path.join(out,'guest05-walk-study.png'),path.join(out,'guest05-walk-study-game.png'),
    ...['front','left','right','back'].flatMap(d=>[1,2,3,4].map(f=>path.join(d==='front'?path.join(body,'generated'):out,`${d}-walk-${f}.png`)))
  ]);
  console.log('Anchor rebuilt from editable source through all 16 frames; source receipt recorded, no visual approval granted.');
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await buildAnchor();
