import assert from "node:assert/strict";
import test from "node:test";
import {
  auditCriticalWeddingDisplay,
  createCriticalWeddingDisplayManifest,
  extractCriticalWeddingDisplayText,
  normalizeCriticalCodePoints
} from "./lib/criticalWeddingDisplayAudit.mjs";

test("critical display font extraction follows every Hangul glyph in public-screen sources", () => {
  const text = extractCriticalWeddingDisplayText(`
    export function Example() {
      return <><h1>두 사람의 정원</h1><BottomSheet title="오시는 길" /><p>본문 제외</p></>;
    }
  `, "client/src/components/Example.tsx");
  const codePoints = normalizeCriticalCodePoints(text);
  for (const character of "두사람의정원오시는길본문제외") assert.ok(codePoints.includes(character));
});

test("critical display font audit rejects a missing title glyph", () => {
  const corpus = "가나다";
  const font = Buffer.from("font");
  const requiredCodePoints = normalizeCriticalCodePoints("가나다라");
  const manifest = createCriticalWeddingDisplayManifest({ corpus, font, requiredCodePoints, sourceFileCount: 23 });
  const result = auditCriticalWeddingDisplay({ corpus, font, manifest, requiredCodePoints });
  assert.deepEqual(result.missingCodePoints, ["라"]);
});

test("critical display font audit rejects corpus and generated font drift", () => {
  const requiredCodePoints = normalizeCriticalCodePoints("가나다");
  const manifest = createCriticalWeddingDisplayManifest({ corpus: "가나다", font: Buffer.from("font-a"), requiredCodePoints, sourceFileCount: 23 });
  const result = auditCriticalWeddingDisplay({ corpus: "가나다라", font: Buffer.from("font-b"), manifest, requiredCodePoints });
  assert.ok(result.issues.some((issue) => issue.includes("코퍼스 해시")));
  assert.ok(result.issues.some((issue) => issue.includes("WOFF2 해시")));
});

test("display coverage includes imported character and gallery JSON and actual font glyphs", async () => {
  const { readCriticalWeddingDisplayAuditInputs } = await import('./lib/criticalWeddingDisplayAudit.mjs');
  const root = new URL('..', import.meta.url).pathname;
  const input = await readCriticalWeddingDisplayAuditInputs(root);
  for (const file of ['character-assets/guest-character-presets.json','shared/character-catalog.json','shared/src/weddingGalleryAssets.json']) {
    assert.ok(input.sourceEntries.some(entry=>entry.relativePath===file),file);
  }
  for (const char of '크림 롱 웨이브 원피스') assert.ok(input.fontCodePoints.has(char.codePointAt(0)),char);
  assert.deepEqual(auditCriticalWeddingDisplay(input).issues,[]);
  const missingActual = new Set(input.fontCodePoints); missingActual.delete('림'.codePointAt(0));
  assert.ok(auditCriticalWeddingDisplay({...input,fontCodePoints:missingActual}).issues.some(issue=>issue.includes('실제 글리프 누락')));
});

test("on-demand display fallback retains all modern Hangul for future published titles", async () => {
  const fs = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const { cmap } = await import('./lib/woff2Cmap.mjs');
  const font = new URL('../client/src/assets/fonts/gowun-dodum-extended.woff2',import.meta.url);
  const chars = cmap(font);
  for(let cp=0xac00;cp<=0xd7a3;cp++)assert.ok(chars.has(cp),`missing ${cp.toString(16)}`);
  const manifest=JSON.parse(await fs.readFile(new URL('../client/src/assets/fonts/gowun-dodum-extended.manifest.json',import.meta.url),'utf8'));
  assert.equal(createHash('sha256').update(await fs.readFile(font)).digest('hex'),manifest.fontSha256);
});
