import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'character-assets/rigs/storybook-expansion-v1');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const relative = p => path.relative(root, p);
const anchor = 'character-assets/rigs/guest-05/storybook-concept-v1/front-concept.png';
const anchorHash = hash(await fs.readFile(path.join(root, anchor)));
assert.equal(anchorHash, '49c46c13c6f36ca2249aa2176d91783286df9e40ceca9d2b003018e58882973f');
const progress = JSON.parse(await fs.readFile(path.join(out, 'progress.json')));
const characters = [];
for (let n = 1; n <= 12; n++) {
  const id = `guest-${String(n).padStart(2, '0')}`;
  const original = `character-assets/reference/guest-turnaround-sources/v2/${id}-turnaround-source.png`;
  const character = { id, role: n === 5 ? 'approved-style-anchor' : 'expansion-target', original,
    originalSha256: hash(await fs.readFile(path.join(root, original))), directions: {},
    storybookStatus: progress.characters[id]?.stage || 'not-implemented', visualApproved: false, runtimeEligible: false };
  for (const direction of ['front', 'left', 'right', 'back']) {
    const rigPath = path.join(root, `character-assets/rigs/${id}/three-head-216-v1/${direction}-rig.json`);
    const bytes = await fs.readFile(rigPath);
    const rig = JSON.parse(bytes);
    character.family = rig.template || 'tailored';
    const parts = {};
    for (const [name, part] of Object.entries(rig.parts)) {
      const file = path.resolve(path.dirname(rigPath), part.file);
      parts[name] = { file: relative(file), sha256: hash(await fs.readFile(file)),
        parent: part.parent, pivot: part.pivot, mirrored: part.mirrored === true };
    }
    character.directions[direction] = { legacyRig: relative(rigPath), sha256: hash(bytes), parts };
  }
  characters.push(character);
}
assert.equal(characters.filter(c => c.role === 'expansion-target').length, 11);
const manifest = { version: 1, status: 'source-inventory-not-completion-evidence',
  styleAnchor: { file: anchor, sha256: anchorHash },
  geometry: { frame: [192, 288], head: 72, body: 144, total: 216 },
  requiredGates: ['faithful-original-parts', 'four-independent-directions', 'shared-family-walk',
    '16-frame-source-render', 'alpha-and-joint-continuity', 'visual-review-at-display-size',
    'mobile-selection-and-map', 'service-worker-version', 'release-tests-and-approval'],
  characters };
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'source-inventory.json'), JSON.stringify(manifest, null, 2) + '\n');
const studyLinks = Object.entries(progress.characters).filter(([,p])=>p.review).map(([id,p])=>{
  assert.match(id,/^guest-[0-9]{2}$/);assert.ok(p.review.startsWith('../'+id+'/'));
  return `<p><a href="${p.review}">${id} 새 원본 리그 · ${p.renderedFrames}프레임 연구 보기</a> — 운영 미반영</p>`;
}).join('');
const familyNames = { dress: '원피스·스커트', femaleHanbok: '여성 한복', maleHanbok: '남성 한복', tailored: '정장·바지' };
await fs.writeFile(path.join(out, 'index.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>승인 외형 확장 원본 목록</title><style>body{font:15px/1.6 system-ui;margin:24px;background:#f3f0e9;color:#302c28}main{max-width:1000px;margin:auto}img{max-width:100%;height:auto}article{background:white;padding:16px;margin:20px 0;border-radius:12px}a{color:#354e87}</style><main><h1>승인 외형 기준 11명 확장</h1><p>새 원본 연구와 기존 자산 목록을 구분합니다. 아래 기존 턴어라운드는 과거 자료이며 현재 의상 기준은 선택 화면 기준안·현행 파츠와 대조해야 합니다. 전체 시각 검증·운영 전환은 미완료입니다.</p>${studyLinks}<a href="../guest-05/storybook-concept-v1/front-concept.png">승인 스타일 원화</a> · <a href="source-inventory.json">파츠·방향별 원본 해시</a>${characters.map(c => `<article><h2>${c.id} · ${familyNames[c.family] || c.family}${c.role === 'approved-style-anchor' ? ' · 스타일 기준 캐릭터' : ''}</h2><p>${progress.characters[c.id] ? '새 원본 연구 진행 중' : '새 스타일 미구현'} / 운영 적용 불가 · 아래는 기존 자료</p><img loading="lazy" src="${path.relative(out, path.join(root, c.original))}" alt="${c.id} 기존 방향별 원본"><p>${Object.keys(c.directions).map(d => `<a href="${path.relative(out, path.join(root, c.directions[d].legacyRig))}">${d} 기존 리그</a>`).join(' · ')}</p></article>`).join('')}</main></html>`);
console.log(JSON.stringify({ characters: characters.length, expansionTargets: 11,
  directions: characters.length * 4, output: relative(out), allPartFilesReadable: true }));
