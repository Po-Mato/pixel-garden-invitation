import test from "node:test";
import assert from "node:assert/strict";
import {
  assessMobileSoakMetrics,
  mobileSoakProfiles,
  summarizeFrameSamples
} from "./lib/mobileDeviceSoakAudit.mjs";

test("mobile soak covers Android Chromium and iOS WebKit", () => {
  assert.deepEqual(mobileSoakProfiles.map(({ id }) => id), ["android-chromium", "ios-webkit"]);
});

test("mobile soak accepts stable repeated interaction metrics", () => {
  assert.deepEqual(assessMobileSoakMetrics({
    pageErrors: [], failedRequests: [], touchResponded: true, layoutStable: true,
    typographyFallbackReady: true, sheetContained: true, averageFps: 58, baselineFps: 60, heapGrowthRatio: 0.08
  }), []);
});

test("mobile soak uses the median of repeated frame samples", () => {
  assert.deepEqual(summarizeFrameSamples([60, 11, 59]), {
    samples: [60, 11, 59], medianFps: 59, minimumFps: 11, maximumFps: 60
  });
});

test("mobile soak calibrates an engine-limited runner without hiding an app slowdown", () => {
  const stableRunner = {
    pageErrors: [], failedRequests: [], touchResponded: true, layoutStable: true,
    typographyFallbackReady: true, sheetContained: true, averageFps: 11, baselineFps: 11, heapGrowthRatio: null
  };
  assert.deepEqual(assessMobileSoakMetrics(stableRunner), []);
  assert.deepEqual(assessMobileSoakMetrics({ ...stableRunner, averageFps: 7 }), [
    "낮은 프레임 7 FPS (러너 기준 11 FPS)"
  ]);
});

test("mobile soak reports interaction, frame, and memory regressions", () => {
  assert.deepEqual(assessMobileSoakMetrics({
    pageErrors: ["boom"], failedRequests: ["asset"], touchResponded: false, layoutStable: false,
    typographyFallbackReady: false, sheetContained: false, averageFps: 20, baselineFps: 60, heapGrowthRatio: 0.5
  }), [
    "페이지 오류 1개",
    "요청 실패 1개",
    "반복 터치 무응답",
    "반복 조작 후 HUD 또는 맵 화면 틀어짐",
    "안드로이드 한글 폰트 대체 누락",
    "큰 글자 바텀시트 화면 이탈",
    "낮은 프레임 20 FPS (러너 기준 60 FPS)",
    "메모리 증가 50%"
  ]);
});
