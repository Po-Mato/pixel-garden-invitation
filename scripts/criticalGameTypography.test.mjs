import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { collectFixedGameHangul, extractFixedHangul, fontFaces } from './lib/criticalGameTypographyAudit.mjs';
import { cmap } from './lib/woff2Cmap.mjs';
const root = path.resolve(import.meta.dirname,'..');
const css = fs.readFileSync(path.join(root,'client/src/game-ui-font-critical.css'),'utf8');
const faces = fontFaces(css);
const coverage = new Set();
for (const face of faces) {
  const actual = cmap(path.resolve(root,'client/src',face.url));
  for (const cp of face.codePoints) if (actual.has(cp)) coverage.add(cp);
}
test('every fixed production Hangul literal is covered by shipped font cmap AND CSS ranges',async()=>{
  const {glyphs, files} = await collectFixedGameHangul(root);
  assert.ok(files.length > 100);
  const missing = [...glyphs].filter(cp=>!coverage.has(cp));
  assert.deepEqual(missing.map(cp=>String.fromCodePoint(cp)),[]);
});
test('collects JSX, templates and decomposed Hangul but ignores comments',()=>{
  const result=extractFixedHangul('// 힣\nconst x = <p>걷기 {`멈${n}췄`} {"탬"} {"하"}</p>;', 'example.tsx');
  assert.deepEqual([...result].sort(),[...new Set([...'걷기멈췄탬하'].map(c=>c.codePointAt(0)))].sort());
});
test('generated nickname coverage agrees with the actual critical fonts',()=>{
  const source = fs.readFileSync(path.join(root,'client/src/game/gameTypographyGlyphs.ts'),'utf8');
  const glyphs=JSON.parse(source.match(/= (".*");/)[1]);
  for(const c of glyphs)assert.ok(coverage.has(c.codePointAt(0)),`loader claims missing glyph ${c}`);
  for(const c of '걷굵멈횡탬')assert.ok(glyphs.includes(c));
});
test('replacement preserves the old shard, variable weight CSS, font hash and core offline cache classification',()=>{
  const fontPath=path.join(root,'client/src/assets/fonts/noto-sans-kr-110-ui-wght-normal.woff2');
  const actual=cmap(fontPath);
  const previous=cmap(path.join(root,'client/node_modules/@fontsource-variable/noto-sans-kr/files/noto-sans-kr-110-wght-normal.woff2'));
  for(const cp of previous)assert.ok(actual.has(cp),`lost original glyph ${cp}`);
  assert.equal(faces.length,11,'do not add font requests');
  assert.match(css,/font-weight: 100 900;/);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'client/src/assets/fonts/noto-sans-kr-110-ui.manifest.json'),'utf8'));
  assert.equal(createHash('sha256').update(fs.readFileSync(fontPath)).digest('hex'),manifest.fontSha256);
  const sw=fs.readFileSync(path.join(root,'client/src/pwa/serviceWorkerSource.ts'),'utf8');
  const literal=sw.match(/const criticalBuildAssetPattern = (\/.*\/i);/)[1];
  const pattern=new RegExp(literal.slice(1,-2),'i');
  assert.ok(pattern.test('noto-sans-kr-110-ui-wght-normal-EXAMPLE.woff2'));
});

test('extended font CSS and actual cmap cover all 11,172 modern Hangul syllables',()=>{
  const directory=path.join(root,'client/node_modules/@fontsource-variable/noto-sans-kr');
  const extended=new Set();
  for(const face of fontFaces(fs.readFileSync(path.join(directory,'wght.css'),'utf8'))){
    const actual=cmap(path.resolve(directory,face.url));
    for(const cp of face.codePoints)if(actual.has(cp))extended.add(cp);
  }
  const missing=[];
  for(let cp=0xac00;cp<=0xd7a3;cp++)if(!extended.has(cp))missing.push(cp);
  assert.deepEqual(missing,[]);
});
