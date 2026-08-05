import assert from "node:assert/strict";
import test from "node:test";
import { contrastRatio, evaluateMapToneMetrics, relativeLuminance } from "./lib/mapToneAudit.mjs";

const thresholds = { maxLuminanceDelta: 0.03, minDynamicRange: 0.16, minTextContrast: 4.5 };

test("map tone audit accepts a stable exposure with readable labels", () => {
  const metrics = { averageLuminance: 0.5, p10Luminance: 0.2, p90Luminance: 0.8 };
  const result = evaluateMapToneMetrics(metrics, metrics, thresholds);
  assert.deepEqual(result.issues, []);
  assert.ok(result.contrasts.portal >= 4.5);
});

test("map tone audit catches exposure drift and flattened map depth", () => {
  const result = evaluateMapToneMetrics(
    { averageLuminance: 0.62, p10Luminance: 0.48, p90Luminance: 0.58 },
    { averageLuminance: 0.5, p10Luminance: 0.2, p90Luminance: 0.8 },
    thresholds
  );
  assert.ok(result.issues.includes("averageLuminance 기준선 이탈"));
  assert.ok(result.issues.includes("맵 명암 폭 부족"));
});

test("relative luminance produces the expected black-white contrast", () => {
  assert.equal(relativeLuminance([0, 0, 0]), 0);
  assert.equal(relativeLuminance([255, 255, 255]), 1);
  assert.equal(contrastRatio(0, 1), 21);
});
