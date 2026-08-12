import assert from "node:assert/strict";
import test from "node:test";
import {
  auditTypographyScaleReports,
  typographyScaleAuditProfiles
} from "./lib/typographyScaleAudit.mjs";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./lib/typographyScaleAudit.mjs", import.meta.url), "utf8");

const report = (profile, bodyFontSize, sheetScrollHeight, cardHeight) => ({
  ...profile,
  sheetContained: true,
  horizontalContentContained: true,
  cardsContained: true,
  cardsSeparated: true,
  lineHeightReady: true,
  touchTargetsReady: true,
  maxScroll: Math.max(0, sheetScrollHeight - 700),
  bodyFontSize,
  sheetScrollHeight,
  cardHeights: { venue: cardHeight },
  scrollStates: { top: { reached: true }, middle: { reached: true }, bottom: { reached: true } }
});

test("typography scale audit covers 100, 150, and 200 percent", () => {
  assert.match(source, /sheet\.locator\("\.bottom-sheet__body"\)/);
  assert.deepEqual(typographyScaleAuditProfiles, [
    { id: "text-100", percent: 100, requiredScroll: 0 },
    { id: "text-150", percent: 150, requiredScroll: 40 },
    { id: "text-200", percent: 200, requiredScroll: 160 }
  ]);
  assert.deepEqual(auditTypographyScaleReports([
    report(typographyScaleAuditProfiles[0], 16, 700, 100),
    report(typographyScaleAuditProfiles[1], 24, 820, 150),
    report(typographyScaleAuditProfiles[2], 32, 940, 200)
  ]), []);
});

test("typography scale audit rejects clipping, weak line height, and reversed card growth", () => {
  const reports = [
    report(typographyScaleAuditProfiles[0], 16, 700, 100),
    report(typographyScaleAuditProfiles[1], 24, 820, 90),
    {
      ...report(typographyScaleAuditProfiles[2], 32, 940, 200),
      horizontalContentContained: false,
      lineHeightReady: false,
      scrollStates: { bottom: { reached: false } }
    }
  ];
  const issues = auditTypographyScaleReports(reports);
  assert.ok(issues.includes("text-200: 콘텐츠 가로 넘침"));
  assert.ok(issues.includes("text-200: 본문 줄높이 부족"));
  assert.ok(issues.includes("text-200/bottom: 스크롤 위치 도달 실패"));
  assert.ok(issues.includes("text-100/text-150/venue: 카드 높이 역전"));
});
