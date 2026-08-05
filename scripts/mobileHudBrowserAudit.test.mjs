import test from "node:test";
import assert from "node:assert/strict";
import {
  auditInvitationQualityMetrics,
  auditMobileHudRectangles,
  auditWorldLabelRectangles,
  auditWorldLabelZoneSweep,
  compactDynamicViewport,
  dynamicViewportResizeApplied,
  mobileHudAuditViewports,
  summarizeTouchLatency,
  worldLabelAuditScenarios
} from "./lib/mobileHudBrowserAudit.mjs";

test("mobile HUD audit covers phones and tablets in both orientations", () => {
  assert.deepEqual(mobileHudAuditViewports.map(({ id }) => id), [
    "iphone-portrait",
    "small-android",
    "phone-landscape",
    "tablet-portrait",
    "tablet-landscape",
    "galaxy-s23-font-150",
    "iphone-15-dynamic-type",
    "iphone-15-webkit-dynamic-type"
  ]);
  assert.deepEqual(
    mobileHudAuditViewports.filter(({ textScale }) => textScale === "xlarge").map(({ id, platform }) => ({ id, platform })),
    [
      { id: "galaxy-s23-font-150", platform: "android" },
      { id: "iphone-15-dynamic-type", platform: "ios" },
      { id: "iphone-15-webkit-dynamic-type", platform: "ios" }
    ]
  );
  assert.equal(mobileHudAuditViewports.find(({ id }) => id === "iphone-15-webkit-dynamic-type")?.engine, "webkit");
});

test("world label sweep covers every production zone with representative positions", () => {
  assert.equal(worldLabelAuditScenarios.length, 17);
  assert.deepEqual([...new Set(worldLabelAuditScenarios.map(({ zoneId }) => zoneId))], [
    "home",
    "neighborhood",
    "subway-station",
    "subway-train",
    "venue-exterior",
    "lobby",
    "bridal-room",
    "ceremony-hall",
    "banquet",
    "restroom"
  ]);
});

test("mobile HUD rectangle audit accepts separated controls", () => {
  assert.deepEqual(auditMobileHudRectangles({
    hud: { x: 8, y: 8, width: 344, height: 90 },
    minimap: { x: 298, y: 120, width: 54, height: 54 },
    collection: { x: 8, y: 480, width: 54, height: 44 },
    controls: { x: 8, y: 540, width: 344, height: 92 },
    context: null
  }, { width: 360, height: 640 }), []);
});

test("mobile HUD rectangle audit catches clipping and meaningful overlap", () => {
  assert.deepEqual(auditMobileHudRectangles({
    hud: { x: 8, y: 8, width: 344, height: 90 },
    minimap: { x: 340, y: 120, width: 54, height: 54 },
    controls: { x: 8, y: 540, width: 344, height: 92 },
    context: { x: 80, y: 560, width: 200, height: 48 }
  }, { width: 360, height: 640 }), [
    "minimap 화면 이탈",
    "context/controls 겹침"
  ]);
});

test("world label audit accepts priority-hidden labels and rejects visible collisions", () => {
  assert.deepEqual(auditWorldLabelRectangles([
    { id: "spot:0", rect: { x: 10, y: 10, width: 92, height: 58 } },
    { id: "portal:0", rect: { x: 120, y: 20, width: 90, height: 20 } }
  ]), []);
  assert.deepEqual(auditWorldLabelRectangles([
    { id: "spot:0", rect: { x: 10, y: 10, width: 92, height: 58 } },
    { id: "npc:0", rect: { x: 50, y: 30, width: 84, height: 20 } }
  ]), ["spot:0/npc:0 라벨 겹침"]);
});

test("world label zone sweep reports missing zones, empty candidates, and collisions", () => {
  assert.deepEqual(auditWorldLabelZoneSweep([
    {
      id: "home-center",
      zoneId: "home",
      candidateCount: 2,
      visibleLabels: [
        { id: "spot:directions", rect: { x: 10, y: 10, width: 92, height: 58 } },
        { id: "portal:exit", rect: { x: 120, y: 20, width: 90, height: 20 } }
      ]
    }
  ], ["home"]), []);
  assert.deepEqual(auditWorldLabelZoneSweep([
    {
      id: "home-center",
      zoneId: "home",
      candidateCount: 0,
      visibleLabels: [
        { id: "spot:directions", rect: { x: 10, y: 10, width: 92, height: 58 } },
        { id: "portal:exit", rect: { x: 50, y: 30, width: 84, height: 20 } }
      ]
    }
  ], ["home", "lobby"]), [
    "lobby: 라벨 감사 누락",
    "home-center: 라벨 후보 없음",
    "home-center: spot:directions/portal:exit 라벨 겹침"
  ]);
});

test("dynamic viewport audit covers address-bar contraction without creating unusably short screens", () => {
  assert.deepEqual(compactDynamicViewport({ width: 390, height: 844 }), { width: 390, height: 724 });
  assert.deepEqual(compactDynamicViewport({ width: 844, height: 390 }), { width: 844, height: 342 });
  assert.equal(dynamicViewportResizeApplied(
    { width: 393, height: 732 },
    { width: 393, height: 732 }
  ), true);
  assert.equal(dynamicViewportResizeApplied(
    { width: 393, height: 732 },
    { width: 393, height: 852 }
  ), false);
});

test("joystick latency uses repeated-sample median instead of a runner spike", () => {
  assert.equal(summarizeTouchLatency([18.4, 141.2, 20.1]), 20.1);
  assert.equal(summarizeTouchLatency([18.4, 20.2]), 19.3);
});

test("invitation quality audit protects compact labels, Korean fallbacks, and large text sheets", () => {
  assert.deepEqual(auditInvitationQualityMetrics({
    floatingSpot: { hitTargetPreserved: true, visuallyCompact: true, contentContained: true },
    typography: { koreanFallbackReady: true, bundledFontsReady: true, fontResourcesSameOrigin: true },
    largeTextSheet: { contained: true, contentContained: true, touchTargetsReady: true },
    scrollStates: {
      "directions-xlarge-middle": { reached: true },
      "directions-xlarge-bottom": { reached: true }
    }
  }), []);
  assert.deepEqual(auditInvitationQualityMetrics({
    floatingSpot: { hitTargetPreserved: false, visuallyCompact: false, contentContained: false },
    typography: { koreanFallbackReady: false, bundledFontsReady: false, fontResourcesSameOrigin: false },
    largeTextSheet: { contained: false, contentContained: false, touchTargetsReady: false },
    scrollStates: { "directions-xlarge-bottom": { reached: false } }
  }), [
    "월드 안내 터치 영역 축소",
    "월드 안내 카드 크기 초과",
    "월드 안내 문구 넘침",
    "안드로이드 한글 폰트 대체 누락",
    "번들 한글 폰트 로드 실패",
    "한글 폰트 외부 출처 요청",
    "큰 글자 바텀시트 화면 이탈",
    "큰 글자 바텀시트 가로 넘침",
    "큰 글자 바텀시트 터치 영역 부족",
    "directions-xlarge-bottom 스크롤 위치 도달 실패"
  ]);
});
