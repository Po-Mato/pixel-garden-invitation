import assert from "node:assert/strict";
import test from "node:test";
import {
  auditCriticalWeddingSerif,
  createCriticalWeddingSerifManifest,
  extractCriticalWeddingSerifText,
  normalizeCriticalCodePoints
} from "./lib/criticalWeddingSerifAudit.mjs";

test("critical serif extraction follows headings and sheet titles", () => {
  const text = extractCriticalWeddingSerifText(`
    export function Example() {
      return <><h1>두 사람의 정원</h1><BottomSheet title="오시는 길" /><p>본문 제외</p></>;
    }
  `, "client/src/components/Example.tsx");
  const codePoints = normalizeCriticalCodePoints(text);
  for (const character of "두사람의정원오시는길") assert.ok(codePoints.includes(character));
  assert.equal(codePoints.includes("본"), false);
});

test("critical serif audit rejects a missing title glyph", () => {
  const corpus = "가나다";
  const font = Buffer.from("font");
  const requiredCodePoints = normalizeCriticalCodePoints("가나다라");
  const manifest = createCriticalWeddingSerifManifest({ corpus, font, requiredCodePoints, sourceFileCount: 23 });
  const result = auditCriticalWeddingSerif({ corpus, font, manifest, requiredCodePoints });
  assert.deepEqual(result.missingCodePoints, ["라"]);
});

test("critical serif audit rejects corpus and generated font drift", () => {
  const requiredCodePoints = normalizeCriticalCodePoints("가나다");
  const manifest = createCriticalWeddingSerifManifest({ corpus: "가나다", font: Buffer.from("font-a"), requiredCodePoints, sourceFileCount: 23 });
  const result = auditCriticalWeddingSerif({ corpus: "가나다라", font: Buffer.from("font-b"), manifest, requiredCodePoints });
  assert.ok(result.issues.some((issue) => issue.includes("코퍼스 해시")));
  assert.ok(result.issues.some((issue) => issue.includes("WOFF2 해시")));
});
