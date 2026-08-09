import assert from "node:assert/strict";
import test from "node:test";
import {
  assessQualityCalibrationDeepLinkCanary,
  qualityCalibrationDeepLinkUrl
} from "./lib/qualityCalibrationDeepLinkCanary.mjs";

test("quality calibration canary requires real auth, analytics, focus, and viewport visibility", () => {
  assert.deepEqual(assessQualityCalibrationDeepLinkCanary({
    sessionStatus: 200,
    analyticsStatuses: [200, 200],
    target: { weekStart: "2026-08-03", metricKey: "cls" },
    deepLinked: true,
    focused: true,
    visible: true,
    pageErrors: []
  }), { status: "passed", issues: [] });
  assert.deepEqual(assessQualityCalibrationDeepLinkCanary({
    sessionStatus: 401,
    analyticsStatuses: [],
    target: null
  }).issues, [
    "관리자 세션 응답 401",
    "관리자 통계 응답 누락",
    "보정 딥링크 대상 누락",
    "정확한 보정 카드 강조 누락",
    "보정 카드 키보드 초점 누락",
    "보정 카드 화면 중앙 노출 누락"
  ]);
});

test("quality calibration canary builds an exact analytics deep link", () => {
  const url = new URL(qualityCalibrationDeepLinkUrl(
    "https://example.test/invitation/?ignored=kept",
    { weekStart: "2026-08-03", metricKey: "long-frame" }
  ));
  assert.equal(url.searchParams.get("admin"), "analytics");
  assert.equal(url.searchParams.get("calibrationWeek"), "2026-08-03");
  assert.equal(url.searchParams.get("calibrationMetric"), "long-frame");
  assert.equal(url.searchParams.get("ignored"), "kept");
});
