import test from "node:test";
import assert from "node:assert/strict";
import {
  auditInvitationQualityMetrics,
  auditHudTextContainment,
  auditLongVenueLayout,
  auditMobileHudRectangles,
  auditPlayerNameplate,
  auditWorldLabelRectangles,
  auditWorldLabelZoneSweep,
  compactDynamicViewport,
  dynamicViewportLayoutApplied,
  dynamicViewportResizeApplied,
  iosSafariText200AuditCss,
  iosText200AuditCss,
  longVenueAuditProfiles,
  mobileHudAuditViewports,
  mobileHudCollisionMatrixProfiles,
  summarizeTouchLatency,
  worldLabelAuditProfiles,
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
    "iphone-15-webkit-dynamic-type",
    "iphone-15-webkit-text-200"
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
  assert.deepEqual(
    mobileHudAuditViewports.find(({ id }) => id === "iphone-15-webkit-text-200"),
    {
      id: "iphone-15-webkit-text-200",
      width: 393,
      height: 852,
      deviceScaleFactor: 3,
      platform: "ios",
      engine: "webkit",
      textScale: "ios-200",
      requiredSheetScroll: 160
    }
  );
});

test("floating UI collision matrix covers 320–430 widths, 100–200% text, and landscape", () => {
  assert.equal(mobileHudCollisionMatrixProfiles.length, 15);
  assert.deepEqual(
    [...new Set(mobileHudCollisionMatrixProfiles
      .filter(({ orientation }) => orientation === "portrait")
      .map(({ width }) => width))],
    [320, 360, 390, 430]
  );
  assert.deepEqual(
    [...new Set(mobileHudCollisionMatrixProfiles.map(({ textPercent }) => textPercent))],
    [100, 150, 200]
  );
  assert.equal(mobileHudCollisionMatrixProfiles.filter(({ orientation }) => orientation === "landscape").length, 3);
});

test("long venue audit covers the narrowest portrait and landscape phones", () => {
  assert.deepEqual(longVenueAuditProfiles, [
    { id: "venue-320-portrait", width: 320, height: 568, orientation: "portrait" },
    { id: "venue-568-landscape", width: 568, height: 320, orientation: "landscape" }
  ]);
});

test("real Safari 200% uses native text adjustment without double scaling", () => {
  assert.match(iosText200AuditCss, /bottom-sheet__body[\s\S]*font-size:\s*200%/);
  assert.doesNotMatch(iosSafariText200AuditCss, /bottom-sheet__body\s*\{\s*font-size:\s*200%/);
  assert.match(iosSafariText200AuditCss, /-webkit-text-size-adjust:\s*200%/);
});

test("world label sweep covers every production zone with representative positions", () => {
  assert.deepEqual(worldLabelAuditProfiles, [
    { id: "iphone-portrait", width: 393, height: 852, deviceScaleFactor: 2 },
    { id: "compact-android", width: 360, height: 640, deviceScaleFactor: 3 },
    { id: "phone-landscape", width: 844, height: 390, deviceScaleFactor: 2 }
  ]);
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

test("mobile HUD rectangle audit catches expanded tool collisions", () => {
  assert.deepEqual(auditMobileHudRectangles({
    hud: { x: 8, y: 8, width: 344, height: 90 },
    tools: { x: 8, y: 96, width: 344, height: 230 },
    minimap: { x: 300, y: 110, width: 52, height: 52 },
    controls: { x: 8, y: 540, width: 344, height: 92 }
  }, { width: 360, height: 640 }), ["tools/minimap 겹침"]);
});

test("landscape HUD text audit rejects clipped zone and destination labels", () => {
  assert.deepEqual(auditHudTextContainment([
    { id: "현재 구역", text: "우리 집", clippedInline: false, clippedBlock: false, lineCount: 1, maxLines: 2 },
    { id: "다음 목적지", text: "지하철역", clippedInline: true, clippedBlock: false, lineCount: 3, maxLines: 2 }
  ]), ["다음 목적지 문구 잘림", "다음 목적지 문구 과도한 줄바꿈"]);
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
  assert.deepEqual(auditWorldLabelZoneSweep([
    {
      id: "home-center",
      profileId: "compact-android",
      zoneId: "home",
      candidateCount: 2,
      visibleLabels: []
    }
  ], ["home"], ["compact-android", "phone-landscape"]), [
    "phone-landscape/home: 라벨 감사 누락"
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
  assert.equal(dynamicViewportLayoutApplied(
    { width: 393, height: 732 },
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
    typography: { koreanFallbackReady: true, uiFontReady: true, bundledDisplayFontReady: true, fontResourcesSameOrigin: true },
    largeTextSheet: {
      contained: true,
      contentContained: true,
      touchTargetsReady: true,
      actualScrollRange: 240,
      requiredScrollRange: 160
    },
    scrollStates: {
      "directions-xlarge-middle": { reached: true },
      "directions-xlarge-bottom": { reached: true }
    }
  }), []);
  assert.deepEqual(auditInvitationQualityMetrics({
    floatingSpot: { hitTargetPreserved: false, visuallyCompact: false, contentContained: false },
    typography: { koreanFallbackReady: false, uiFontReady: false, bundledDisplayFontReady: false, fontResourcesSameOrigin: false },
    largeTextSheet: {
      contained: false,
      contentContained: false,
      touchTargetsReady: false,
      actualScrollRange: 48,
      requiredScrollRange: 160
    },
    scrollStates: { "directions-xlarge-bottom": { reached: false } }
  }), [
    "월드 안내 터치 영역 축소",
    "월드 안내 카드 크기 초과",
    "월드 안내 문구 넘침",
    "안드로이드 한글 폰트 대체 누락",
    "시스템 한글 UI 폰트 준비 실패",
    "번들 한글 명조 폰트 로드 실패",
    "한글 폰트 외부 출처 요청",
    "큰 글자 바텀시트 화면 이탈",
    "큰 글자 바텀시트 가로 넘침",
    "큰 글자 바텀시트 터치 영역 부족",
    "iOS 200% 큰 글자 바텀시트 실제 스크롤 범위 부족",
    "directions-xlarge-bottom 스크롤 위치 도달 실패"
  ]);
});

test("player nameplate audit accepts one-line ellipsis with the full accessible name", () => {
  assert.deepEqual(auditPlayerNameplate({
    singleLine: true,
    contained: true,
    ellipsisReady: true,
    fullNameAvailable: true
  }), []);
  assert.deepEqual(auditPlayerNameplate({}), [
    "캐릭터 이름표 줄바꿈",
    "캐릭터 이름표 영역 이탈",
    "긴 캐릭터 이름 말줄임 누락",
    "캐릭터 전체 이름 접근 불가"
  ]);
});

test("long venue layout audit protects full Korean venue text on compact phones", () => {
  assert.deepEqual(auditLongVenueLayout({
    sheetContained: true,
    contentContained: true,
    venueTextComplete: true,
    venueLinesReady: true,
    addressLinesReady: true,
    copyTargetReady: true
  }), []);
  assert.deepEqual(auditLongVenueLayout({}), [
    "오시는 길 시트 화면 이탈",
    "오시는 길 긴 문구 가로 넘침",
    "예식장 전체 문구 누락",
    "예식장 문구 과도한 줄바꿈",
    "예식장 주소 과도한 줄바꿈",
    "주소 복사 터치 영역 부족"
  ]);
});
