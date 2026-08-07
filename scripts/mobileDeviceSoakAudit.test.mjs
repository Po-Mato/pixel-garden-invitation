import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assessMobileSoakMetrics,
  assessMotionResponsiveness,
  mobileSoakProfiles,
  summarizeFrameSamples,
  summarizeMovementSamples,
  summarizeZoneBottlenecks,
  summarizeZoneTransitionSamples
} from "./lib/mobileDeviceSoakAudit.mjs";

test("mobile soak covers Android Chromium, iOS WebKit, and a cold-cache thermal Android", () => {
  assert.deepEqual(mobileSoakProfiles.map(({ id }) => id), [
    "android-chromium", "ios-webkit", "android-chromium-low-power-cold-thermal"
  ]);
  assert.deepEqual(mobileSoakProfiles[2], {
    id: "android-chromium-low-power-cold-thermal",
    engine: "chromium",
    device: "Pixel 7",
    powerMode: "battery",
    cacheMode: "cold",
    cpuThrottlingRate: 4,
    trace: true
  });
});

test("mobile soak identifies the worst low-power zone from repeated frame tails", () => {
  const transitions = [
    { zoneId: "home", durationMs: 300, frameDeltas: [16, 17, 18], imageDecode: { readyMs: 40, resourceLoadMs: 30, decodedBodySize: 1_000 } },
    { zoneId: "lobby", durationMs: 420, frameDeltas: [16, 20, 88], imageDecode: { readyMs: 96, resourceLoadMs: 80, decodedBodySize: 2_000 } },
    { zoneId: "home", durationMs: 320, frameDeltas: [16, 17, 19], imageDecode: { readyMs: 44, resourceLoadMs: 32, decodedBodySize: 1_000 } },
    { zoneId: "lobby", durationMs: 450, frameDeltas: [17, 24, 96], imageDecode: { readyMs: 110, resourceLoadMs: 92, decodedBodySize: 2_000 } }
  ];
  const summary = summarizeZoneBottlenecks(transitions);
  assert.equal(summary.worstZoneId, "lobby");
  assert.equal(summary.zones[0].transitionCount, 2);
  assert.equal(summary.zones[0].maximumTransitionDurationMs, 450);
  assert.ok(summary.zones[0].p99FrameMs > summary.zones[1].p99FrameMs);
  assert.equal(summary.worstDecodeZoneId, "lobby");
  assert.equal(summary.maximumImageDecodeReadyMs, 110);
});

test("battery soak requires automatic minimal effects and a worst-zone trace", () => {
  const base = {
    pageErrors: [], failedRequests: [], touchResponded: true, layoutStable: true,
    typographyFallbackReady: true, sheetContained: true, averageFps: 58, baselineFps: 60,
    heapGrowthRatio: null, expectedPowerMode: "battery"
  };
  assert.deepEqual(assessMobileSoakMetrics({
    ...base,
    automaticQuality: { reason: "battery", effects: "minimal" },
    zoneBottlenecks: { worstZoneId: "lobby" }
  }), []);
  assert.deepEqual(assessMobileSoakMetrics({
    ...base,
    automaticQuality: { reason: "standard", effects: "full" },
    zoneBottlenecks: { worstZoneId: null }
  }), [
    "저전력 배터리 모드 자동 감지 실패",
    "저전력 효과 최소화 실패",
    "저전력 최악 구역 프레임 추적 누락"
  ]);
});

test("cold-cache thermal soak requires applied emulation, 12 decode samples, and a trace", () => {
  const zones = [{ zoneId: "lobby", imageDecodeSampleCount: 12, maximumImageDecodeReadyMs: 180 }];
  const metrics = {
    pageErrors: [], failedRequests: [], touchResponded: true, layoutStable: true,
    typographyFallbackReady: true, sheetContained: true, averageFps: 12, baselineFps: 12,
    heapGrowthRatio: null, expectedCacheMode: "cold", expectedCpuThrottlingRate: 4,
    environmentEmulation: { cacheDisabled: true, cpuThrottlingRate: 4, thermalProxy: true },
    zoneBottlenecks: { worstZoneId: "lobby", worstDecodeZoneId: "lobby", maximumImageDecodeReadyMs: 180, zones },
    traceConfigured: true
  };
  assert.deepEqual(assessMobileSoakMetrics(metrics), []);
  assert.deepEqual(assessMobileSoakMetrics({
    ...metrics,
    environmentEmulation: { cacheDisabled: false, cpuThrottlingRate: 1 },
    zoneBottlenecks: { worstZoneId: "lobby", worstDecodeZoneId: null, maximumImageDecodeReadyMs: null, zones: [] },
    traceConfigured: false
  }), [
    "저전력 cold cache 적용 실패",
    "저전력 thermal CPU 제한 적용 실패",
    "cold cache 최초 이미지 decode 표본 부족 0/12",
    "최초 이미지 decode 최악 구역 추적 누락",
    "cold cache thermal trace 누락"
  ]);
});

test("mobile soak closes invitation overlays before measuring movement frames", () => {
  const source = readFileSync("scripts/lib/mobileDeviceSoakAudit.mjs", "utf8");
  const closeMenuAt = source.indexOf('.world-menu-sheet button[aria-label="초대장 메뉴 닫기"]');
  const measureMovementAt = source.indexOf("sampleMovingFrameSeries(page, durationMs)");
  assert.ok(closeMenuAt >= 0);
  assert.ok(measureMovementAt > closeMenuAt);
  assert.match(source.slice(closeMenuAt, measureMovementAt), /virtual-joystick.+state: "visible"/s);
});

test("mobile soak measures destination rendering inside one browser evaluation", () => {
  const source = readFileSync("scripts/lib/mobileDeviceSoakAudit.mjs", "utf8");
  const captureStart = source.indexOf("async function captureZoneTransitionInPage");
  const captureEnd = source.indexOf("async function sampleZoneTransitionSeries", captureStart);
  const captureSource = source.slice(captureStart, captureEnd);
  assert.match(captureSource, /return page\.evaluate\(async/);
  assert.match(captureSource, /button\.click\(\)/);
  assert.match(captureSource, /world-map__stage--background-loaded/);
  assert.match(captureSource, /durationMs:[\s\S]+frameDeltas,[\s\S]+samples/);
  assert.match(source.slice(captureEnd), /await captureZoneTransitionInPage\(page, target, options\)/);
});

test("mobile soak accepts stable repeated interaction metrics", () => {
  assert.deepEqual(assessMobileSoakMetrics({
    pageErrors: [], failedRequests: [], touchResponded: true, layoutStable: true,
    typographyFallbackReady: true, sheetContained: true, averageFps: 58, baselineFps: 60,
    frameTimings: { p95FrameMs: 20, p99FrameMs: 28 },
    baselineFrameTimings: { p95FrameMs: 18, p99FrameMs: 24 }, heapGrowthRatio: 0.08
  }), []);
});

test("mobile soak uses the median of repeated frame samples", () => {
  assert.deepEqual(summarizeFrameSamples([60, 11, 59]), {
    samples: [60, 11, 59], medianFps: 59, minimumFps: 11, maximumFps: 60
  });
});

test("mobile soak summarizes real player movement, camera follow, centering, and settled jitter", () => {
  const sample = (position, camera, visualCenter = { x: 180, y: 320 }) => ({
    position,
    camera,
    visualCenter,
    centerError: { x: visualCenter.x - 180, y: visualCenter.y - 320 }
  });
  const samples = [
    sample({ x: 285, y: 375 }, { x: -105, y: -55 }),
    sample({ x: 345, y: 375 }, { x: -165, y: -55 }, { x: 180.25, y: 320 })
  ];
  const settledSamples = [
    sample({ x: 345, y: 375 }, { x: -165, y: -55 }, { x: 180.25, y: 320 }),
    sample({ x: 345, y: 375 }, { x: -165, y: -55 }, { x: 180.5, y: 320 })
  ];

  assert.deepEqual(summarizeMovementSamples(samples, settledSamples), {
    movementResponded: true,
    cameraFollowed: true,
    movementDistance: 60,
    cameraDistance: 60,
    maxCenterErrorPx: 0.5,
    settledJitterPx: 0.25,
    samples,
    settledSamples
  });
});

test("motion response budgets scale with 60Hz and 120Hz frame cadence", () => {
  assert.deepEqual(assessMotionResponsiveness({
    inputLatencyMs: 42,
    settleLatencyMs: 180,
    frameBudgetMs: 16.67
  }), []);
  assert.deepEqual(assessMotionResponsiveness({
    inputLatencyMs: 52,
    settleLatencyMs: 360,
    frameBudgetMs: 8.33
  }), ["이동 입력 지연 52ms", "카메라 안정화 지연 360ms"]);
});

test("software WebKit keeps movement coverage without treating a missing synthetic latency as hardware evidence", () => {
  assert.deepEqual(assessMobileSoakMetrics({
    pageErrors: [], failedRequests: [], touchResponded: true, layoutStable: true,
    typographyFallbackReady: true, sheetContained: true, movementResponded: true,
    cameraFollowed: true, averageFps: 58, baselineFps: 60, heapGrowthRatio: null,
    motionResponseTimingPolicy: "availability-only",
    motionResponse: { inputLatencyMs: null, settleLatencyMs: 120, frameBudgetMs: 16.67 }
  }), []);
});

test("mobile soak summarizes repeated low-performance zone transitions", () => {
  const layout = { hud: { x: 0, y: 0, width: 390, height: 64 }, map: { x: 0, y: 64, width: 390, height: 716 } };
  const sample = (cameraX = -100) => ({
    camera: { x: cameraX, y: -50 },
    centerError: { x: 0.25, y: 0 },
    cameraBoundsValid: true,
    horizontalOverflow: false,
    layout,
    quality: { mode: "lite", effects: "minimal" }
  });
  const transitions = Array.from({ length: 12 }, (_, index) => ({
    zoneId: ["home", "neighborhood", "lobby", "ceremony-hall", "banquet", "bridal-room"][index % 6],
    durationMs: 420 + index,
    samples: [sample(), sample(-100.25)],
    frameTimings: { p95FrameMs: 18, p99FrameMs: 24 }
  }));
  assert.deepEqual(summarizeZoneTransitionSamples(transitions, layout), {
    transitionCount: 12,
    uniqueZoneIds: ["home", "neighborhood", "lobby", "ceremony-hall", "banquet", "bridal-room"],
    maxTransitionDurationMs: 431,
    maxLayoutDeltaPx: 0,
    maxCenterErrorPx: 0.25,
    maxSettledCameraJitterPx: 0.25,
    cameraBoundsValid: true,
    layoutStable: true,
    lowPerformanceModeStable: true,
    transitions
  });
});

test("mobile soak uses completion latency for software-rasterized WebKit transitions", () => {
  const metrics = {
    pageErrors: [], failedRequests: [], touchResponded: true, layoutStable: true,
    typographyFallbackReady: true, sheetContained: true, averageFps: 58, baselineFps: 62,
    frameTimings: { p95FrameMs: 26, p99FrameMs: 32 },
    baselineFrameTimings: { p95FrameMs: 17, p99FrameMs: 18 },
    zoneTransitionTimingPolicy: "completion-latency",
    zoneTransitionFrameTimings: { p95FrameMs: 328, p99FrameMs: 450 },
    zoneTransitions: {
      transitionCount: 12,
      uniqueZoneIds: ["home", "neighborhood", "lobby", "ceremony-hall", "banquet", "bridal-room"],
      maxTransitionDurationMs: 1_240,
      maxLayoutDeltaPx: 0,
      maxCenterErrorPx: 0.5,
      maxSettledCameraJitterPx: 0,
      cameraBoundsValid: true,
      layoutStable: true,
      lowPerformanceModeStable: true
    },
    heapGrowthRatio: null
  };
  assert.deepEqual(assessMobileSoakMetrics(metrics), []);
  assert.deepEqual(assessMobileSoakMetrics({
    ...metrics,
    zoneTransitions: { ...metrics.zoneTransitions, maxTransitionDurationMs: 2_001 }
  }), ["구역 전환 완료 지연 2001ms"]);
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
    typographyFallbackReady: false, sheetContained: false,
    movementResponded: false, cameraFollowed: false, maxCenterErrorPx: 2.4, settledJitterPx: 1.1,
    averageFps: 20, baselineFps: 60,
    frameTimings: { p95FrameMs: 70, p99FrameMs: 120 },
    baselineFrameTimings: { p95FrameMs: 18, p99FrameMs: 25 }, heapGrowthRatio: 0.5
  }), [
    "페이지 오류 1개",
    "요청 실패 1개",
    "반복 터치 무응답",
    "반복 조작 후 HUD 또는 맵 화면 틀어짐",
    "안드로이드 한글 폰트 대체 누락",
    "큰 글자 바텀시트 화면 이탈",
    "실제 캐릭터 이동 무응답",
    "실제 이동 중 카메라 추적 없음",
    "이동 후 캐릭터 중심 오차 2.4px",
    "이동 정지 후 카메라 미세 흔들림 1.1px",
    "낮은 프레임 20 FPS (러너 기준 60 FPS)",
    "p95 프레임 70ms",
    "p99 프레임 120ms",
    "메모리 증가 50%"
  ]);
});
