import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  assessCrossRunMedianDrift,
  buildMobileDeviceSoakTrend,
  isRemeasurableLowPowerTrendIssue,
  isTransientLowPowerIssue,
  lowPowerSoakProfileId,
  median
} from "./lib/mobileDeviceSoakTrend.mjs";

function report(overrides = {}, issues = []) {
  const metrics = {
    averageFps: 55,
    baselineFps: 60,
    frameRatio: 0.92,
    frameTimings: { p95FrameMs: 30, p99FrameMs: 50 },
    baselineFrameTimings: { p95FrameMs: 20, p99FrameMs: 30 },
    motionResponse: { inputLatencyMs: 45, settleLatencyMs: 180 },
    zoneTransitionFrameTimings: { p95FrameMs: 38, p99FrameMs: 70 },
    zoneTransitions: { maxTransitionDurationMs: 440, maxCenterErrorPx: 0.4, maxSettledCameraJitterPx: 0.2 },
    zoneBottlenecks: { maximumImageDecodeReadyMs: 120, worstZoneId: "lobby", worstDecodeZoneId: "ceremony-hall" },
    ...overrides
  };
  return { reports: [{ id: lowPowerSoakProfileId, metrics, issues }] };
}

test("low-power trend uses the median of three independent runs", () => {
  const trend = buildMobileDeviceSoakTrend([
    report({ averageFps: 52, frameTimings: { p95FrameMs: 28, p99FrameMs: 48 } }),
    report({ averageFps: 12, frameTimings: { p95FrameMs: 160, p99FrameMs: 240 } }, ["낮은 프레임 12 FPS (러너 기준 60 FPS)", "p95 프레임 160ms"]),
    report({ averageFps: 56, frameTimings: { p95FrameMs: 31, p99FrameMs: 52 } })
  ], { sha: "abc123" });
  assert.equal(trend.sampleCount, 3);
  assert.equal(trend.medians.averageFps, 52);
  assert.equal(trend.medians.p95FrameMs, 31);
  assert.equal(trend.status, "passed");
  assert.deepEqual(trend.issues, []);
});

test("low-power trend never hides structural failures", () => {
  const trend = buildMobileDeviceSoakTrend([
    report(),
    report({}, ["반복 조작 후 HUD 또는 맵 화면 틀어짐"]),
    report()
  ]);
  assert.equal(trend.status, "failed");
  assert.match(trend.issues[0], /2회차.*화면 틀어짐/);
});

test("low-power trend validates sample count and helper behavior", () => {
  assert.equal(median([80, 20, 60]), 60);
  assert.equal(isTransientLowPowerIssue("p99 프레임 120ms"), true);
  assert.equal(isTransientLowPowerIssue("저전력 cold cache 적용 실패"), false);
  assert.equal(isRemeasurableLowPowerTrendIssue("3회 중앙 p99FrameMs 120 > 90"), true);
  assert.equal(isRemeasurableLowPowerTrendIssue("CI 실행 간 transitionP95FrameMs 166 > 150"), true);
  assert.equal(isRemeasurableLowPowerTrendIssue("2회차 화면 틀어짐"), false);
  assert.throws(() => buildMobileDeviceSoakTrend([report(), report()]), /표본 부족 2\/3/);
});

test("one profile-level remeasurement uses a four-sample median without hiding structure", () => {
  const trend = buildMobileDeviceSoakTrend([
    report({ frameTimings: { p95FrameMs: 28, p99FrameMs: 48 } }),
    report({ frameTimings: { p95FrameMs: 31, p99FrameMs: 54 } }),
    report({ frameTimings: { p95FrameMs: 180, p99FrameMs: 260 } }, ["p99 프레임 260ms"]),
    report({ frameTimings: { p95FrameMs: 29, p99FrameMs: 50 } })
  ], { remeasurement: { triggered: true, profileId: lowPowerSoakProfileId } });
  assert.equal(trend.sampleCount, 4);
  assert.equal(trend.medians.p95FrameMs, 30);
  assert.equal(trend.medians.p99FrameMs, 52);
  assert.equal(trend.remeasurement.triggered, true);
  assert.equal(trend.status, "passed");
});

test("cross-run drift warms up until three successful CI medians exist", () => {
  const current = buildMobileDeviceSoakTrend([report(), report(), report()]);
  const drift = assessCrossRunMedianDrift([
    { status: "passed", runId: "1", medians: current.medians }
  ], current);
  assert.equal(drift.status, "warming");
  assert.equal(drift.sampleCount, 2);
  assert.deepEqual(drift.baselineRunIds, ["1"]);
});

test("cross-run drift gates a third CI median without reacting to runner noise", () => {
  const current = buildMobileDeviceSoakTrend([report(), report(), report()]);
  const previous = [
    { status: "passed", runId: "1", medians: { ...current.medians, p95FrameMs: 26, inputLatencyMs: 48 } },
    { status: "passed", runId: "2", medians: { ...current.medians, p95FrameMs: 28, inputLatencyMs: 52 } }
  ];
  const passed = assessCrossRunMedianDrift(previous, current);
  assert.equal(passed.status, "passed");
  assert.equal(passed.sampleCount, 3);
  assert.ok(passed.comparisons.every(({ passed: comparisonPassed }) => comparisonPassed));

  const failed = assessCrossRunMedianDrift(previous, {
    ...current,
    medians: { ...current.medians, averageFps: 30, p95FrameMs: 80 }
  });
  assert.equal(failed.status, "failed");
  assert.ok(failed.issues.some((issue) => issue.includes("averageFps")));
  assert.ok(failed.issues.some((issue) => issue.includes("p95FrameMs")));
});

test("mobile soak runner repeats the low-power profile three times", () => {
  const source = readFileSync("scripts/check-mobile-device-soak.mjs", "utf8");
  assert.match(source, /run <= requiredLowPowerRuns/);
  assert.match(source, /profiles: \[lowPowerProfile\]/);
  assert.match(source, /writeMobileDeviceSoakTrend/);
  assert.match(source, /every\(isRemeasurableLowPowerTrendIssue\)/);
  assert.match(source, /repeat-\$\{maximumLowPowerRuns\}/);
});
