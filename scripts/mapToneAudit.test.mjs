import assert from "node:assert/strict";
import test from "node:test";
import {
  calibratedLabelContrasts,
  characterEdgeShadowsFromCss,
  contrastRatio,
  displayCalibrationProfiles,
  evaluateMapToneMetrics,
  mapToneCharacterPositions,
  relativeLuminance
} from "./lib/mapToneAudit.mjs";

const thresholds = {
  maxLuminanceDelta: 0.03,
  minDynamicRange: 0.16,
  minTextContrast: 4.5,
  minCharacterEdgeContrast: 1.2,
  minDisplayCharacterEdgeContrast: 1.1,
  maxCharacterEdgeContrastDelta: 0.15
};

test("map tone audit accepts a stable exposure with readable labels", () => {
  const displayProfiles = Object.fromEntries(Object.entries(displayCalibrationProfiles).map(([id, profile]) => [id, {
    contrasts: calibratedLabelContrasts({ sceneP90Luminance: 0.79 }, profile.adjustLuminance),
    characterEdgeContrasts: { "guest-a": 1.4 },
    characterMovementEdgeContrasts: { "guest-a": { "down-0": 1.35 } }
  }]));
  const metrics = {
    averageLuminance: 0.5,
    p10Luminance: 0.2,
    p90Luminance: 0.8,
    sceneAverageLuminance: 0.49,
    sceneP10Luminance: 0.19,
    sceneP90Luminance: 0.79,
    characterEdgeContrast: 1.4,
    foregroundAssetCount: 2,
    displayProfiles
  };
  const result = evaluateMapToneMetrics(metrics, metrics, thresholds);
  assert.deepEqual(result.issues, []);
  assert.ok(result.contrasts.portal >= 4.5);
});

test("map tone audit compares contrast at the recorded three-decimal precision", () => {
  const displayProfiles = Object.fromEntries(
    Object.keys(displayCalibrationProfiles).map((id) => [id, {
      contrasts: {},
      characterEdgeContrasts: { "guest-a": 1.0996 },
      characterMovementEdgeContrasts: { "guest-a": { "down-0": 1.0996 } }
    }])
  );
  const metrics = {
    averageLuminance: 0.5,
    p10Luminance: 0.2,
    p90Luminance: 0.8,
    sceneAverageLuminance: 0.5,
    sceneP10Luminance: 0.2,
    sceneP90Luminance: 0.8,
    characterEdgeContrasts: { "guest-a": 1.1996 },
    characterPresetCount: 1,
    characterMovementEdgeContrasts: { "guest-a": { "down-0": 1.1996 } },
    movementFrameCount: 1,
    foregroundAssetCount: 2,
    displayProfiles
  };
  const result = evaluateMapToneMetrics(metrics, {
    ...metrics,
    characterEdgeContrasts: { "guest-a": 1.2 },
    characterMovementEdgeContrasts: { "guest-a": { "down-0": 1.2 } }
  }, thresholds);

  assert.equal(result.issues.some((issue) => issue.includes("대비 부족")), false);
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

test("map tone audit catches weak character separation and missing foreground assets", () => {
  const result = evaluateMapToneMetrics(
    {
      averageLuminance: 0.5,
      p10Luminance: 0.2,
      p90Luminance: 0.8,
      sceneAverageLuminance: 0.5,
      sceneP10Luminance: 0.4,
      sceneP90Luminance: 0.5,
      characterEdgeContrast: 1.05,
      foregroundAssetCount: 1
    },
    {
      averageLuminance: 0.5,
      p10Luminance: 0.2,
      p90Luminance: 0.8,
      sceneAverageLuminance: 0.5,
      sceneP10Luminance: 0.2,
      sceneP90Luminance: 0.8,
      characterEdgeContrast: 1.4,
      foregroundAssetCount: 2
    },
    thresholds
  );
  assert.ok(result.issues.includes("합성 장면 명암 폭 부족"));
  assert.ok(result.issues.includes("캐릭터 가장자리 대비 부족"));
  assert.ok(result.issues.includes("캐릭터 가장자리 대비 기준선 이탈"));
  assert.ok(result.issues.includes("합성 전경 수 불일치"));
});

test("map tone audit checks every character preset independently", () => {
  const result = evaluateMapToneMetrics(
    {
      averageLuminance: 0.5,
      p10Luminance: 0.2,
      p90Luminance: 0.8,
      sceneAverageLuminance: 0.5,
      sceneP10Luminance: 0.2,
      sceneP90Luminance: 0.8,
      characterEdgeContrasts: { "guest-a": 1.42, "guest-b": 1.08 },
      characterPresetCount: 2,
      foregroundAssetCount: 2
    },
    {
      averageLuminance: 0.5,
      p10Luminance: 0.2,
      p90Luminance: 0.8,
      sceneAverageLuminance: 0.5,
      sceneP10Luminance: 0.2,
      sceneP90Luminance: 0.8,
      characterEdgeContrasts: { "guest-a": 1.4, "guest-b": 1.4 },
      characterPresetCount: 2,
      foregroundAssetCount: 2
    },
    thresholds
  );
  assert.ok(result.issues.includes("guest-b 캐릭터 가장자리 대비 부족"));
  assert.ok(result.issues.includes("guest-b 캐릭터 가장자리 대비 기준선 이탈"));
});

test("map tone audit rejects a missing character preset measurement", () => {
  const result = evaluateMapToneMetrics(
    {
      averageLuminance: 0.5,
      p10Luminance: 0.2,
      p90Luminance: 0.8,
      characterEdgeContrasts: { "guest-a": 1.4 },
      characterPresetCount: 1
    },
    {
      averageLuminance: 0.5,
      p10Luminance: 0.2,
      p90Luminance: 0.8,
      characterEdgeContrasts: { "guest-a": 1.4, "guest-b": 1.4 },
      characterPresetCount: 2
    },
    thresholds
  );
  assert.ok(result.issues.includes("캐릭터 프리셋 대비 목록 불일치"));
  assert.ok(result.issues.includes("guest-b 캐릭터 가장자리 대비 측정 누락"));
  assert.ok(result.issues.includes("캐릭터 프리셋 감사 수 불일치"));
});

test("map tone audit checks all three moving character frames", () => {
  const stable = { "down-0": 1.4, "down-1": 1.35, "down-2": 1.3 };
  const result = evaluateMapToneMetrics(
    {
      averageLuminance: 0.5,
      p10Luminance: 0.2,
      p90Luminance: 0.8,
      characterMovementEdgeContrasts: {
        "guest-a": stable,
        "guest-b": { "down-0": 1.4, "down-1": 1.05 }
      },
      movementFrameCount: 2
    },
    {
      averageLuminance: 0.5,
      p10Luminance: 0.2,
      p90Luminance: 0.8,
      characterMovementEdgeContrasts: { "guest-a": stable, "guest-b": stable },
      movementFrameCount: 3
    },
    thresholds
  );
  assert.ok(result.issues.includes("guest-b 이동 프레임 대비 목록 불일치"));
  assert.ok(result.issues.includes("guest-b/down-1 이동 가장자리 대비 부족"));
  assert.ok(result.issues.includes("guest-b/down-1 이동 가장자리 대비 기준선 이탈"));
  assert.ok(result.issues.includes("guest-b/down-2 이동 가장자리 대비 측정 누락"));
  assert.ok(result.issues.includes("캐릭터 이동 프레임 감사 수 불일치"));
});

test("map tone audit rejects omitted composited-scene measurements", () => {
  const result = evaluateMapToneMetrics(
    { averageLuminance: 0.5, p10Luminance: 0.2, p90Luminance: 0.8, foregroundAssetCount: 2 },
    {
      averageLuminance: 0.5,
      p10Luminance: 0.2,
      p90Luminance: 0.8,
      sceneAverageLuminance: 0.5,
      sceneP10Luminance: 0.2,
      sceneP90Luminance: 0.8,
      characterEdgeContrast: 1.4,
      foregroundAssetCount: 2
    },
    thresholds
  );
  assert.ok(result.issues.includes("sceneAverageLuminance 측정 누락"));
  assert.ok(result.issues.includes("캐릭터 가장자리 대비 측정 누락"));
});

test("map tone audit parses every zone edge-shadow and fixes one character position per zone", () => {
  const zoneIds = Object.keys(mapToneCharacterPositions);
  const css = zoneIds.map((zoneId, index) => (
    `.world-map__stage[data-zone="${zoneId}"] { --character-edge-shadow: rgba(${index}, 31, 26, 0.42); }`
  )).join("\n");
  const colors = characterEdgeShadowsFromCss(css, zoneIds);
  assert.equal(Object.keys(colors).length, 10);
  assert.equal(colors.home.alpha, 0.42);
  assert.equal(colors.restroom.red, 9);
});

test("relative luminance produces the expected black-white contrast", () => {
  assert.equal(relativeLuminance([0, 0, 0]), 0);
  assert.equal(relativeLuminance([255, 255, 255]), 1);
  assert.equal(contrastRatio(0, 1), 21);
});

test("OLED와 LCD의 저휘도·야외·P3 보정 모델에서도 밝기 순서와 라벨 가독성을 유지한다", () => {
  assert.deepEqual(Object.keys(displayCalibrationProfiles), [
    "oled", "lcd", "oled-low-brightness", "oled-outdoor-p3", "lcd-low-brightness", "lcd-outdoor-srgb"
  ]);
  for (const profile of Object.values(displayCalibrationProfiles)) {
    assert.ok(profile.adjustLuminance(0.8) > profile.adjustLuminance(0.1));
    const contrasts = calibratedLabelContrasts({ sceneP90Luminance: 0.8 }, profile.adjustLuminance);
    assert.ok(Math.min(...Object.values(contrasts)) >= 4.5);
  }
});
