import test from "node:test";
import assert from "node:assert/strict";
import { assessMobileSoakMetrics, mobileSoakProfiles } from "./lib/mobileDeviceSoakAudit.mjs";

test("mobile soak covers Android Chromium and iOS WebKit", () => {
  assert.deepEqual(mobileSoakProfiles.map(({ id }) => id), ["android-chromium", "ios-webkit"]);
});

test("mobile soak accepts stable repeated interaction metrics", () => {
  assert.deepEqual(assessMobileSoakMetrics({
    pageErrors: [], failedRequests: [], touchResponded: true, averageFps: 58, heapGrowthRatio: 0.08
  }), []);
});

test("mobile soak reports interaction, frame, and memory regressions", () => {
  assert.deepEqual(assessMobileSoakMetrics({
    pageErrors: ["boom"], failedRequests: ["asset"], touchResponded: false, averageFps: 20, heapGrowthRatio: 0.5
  }), ["페이지 오류 1개", "요청 실패 1개", "반복 터치 무응답", "낮은 프레임 20 FPS", "메모리 증가 50%"]);
});
