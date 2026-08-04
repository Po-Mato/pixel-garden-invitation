import assert from "node:assert/strict";
import test from "node:test";
import {
  auditMapDiagnosticsSnapshot,
  mapDiagnosticsAuditViewports,
  mapDiagnosticsZoneIds
} from "./lib/mapDiagnosticsBrowserAudit.mjs";

test("map diagnostics browser audit covers three mobile viewport shapes and all zones", () => {
  assert.deepEqual(mapDiagnosticsAuditViewports.map(({ id }) => id), [
    "small-android",
    "iphone-portrait",
    "phone-landscape"
  ]);
  assert.equal(mapDiagnosticsZoneIds.length, 10);
});

test("map diagnostics snapshot accepts a matching visible overlay", () => {
  assert.deepEqual(auditMapDiagnosticsSnapshot({
    selectedZoneId: "home",
    activeZoneId: "home",
    overlayZoneId: "home",
    overlayVisible: true,
    controlsRect: { x: 8, y: 8, width: 250, height: 38 },
    depthCount: 1,
    issueCount: 0,
    activeLayerCount: 4,
    layers: [true, true, true, true]
  }, { width: 360, height: 640 }, 1), []);
});

test("map diagnostics snapshot reports clipping, stale zones, geometry, and depth mismatches", () => {
  assert.deepEqual(auditMapDiagnosticsSnapshot({
    selectedZoneId: "lobby",
    activeZoneId: "home",
    overlayZoneId: "home",
    overlayVisible: false,
    controlsRect: { x: 300, y: 8, width: 100, height: 38 },
    depthCount: 0,
    issueCount: 2,
    activeLayerCount: 2,
    layers: [true, false, true, false]
  }, { width: 360, height: 640 }, 1), [
    "진단 도구 화면 이탈",
    "진단 오버레이 숨김",
    "선택 구역과 활성 구역 불일치",
    "선택 구역과 오버레이 구역 불일치",
    "깊이선 수 불일치 0/1",
    "활성 진단 필터 수 불일치 2/4",
    "기본 진단 필터 비활성",
    "맵 지오메트리 문제 2건"
  ]);
});
