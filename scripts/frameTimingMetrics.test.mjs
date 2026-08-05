import assert from "node:assert/strict";
import test from "node:test";
import {
  assessFrameTimingHeadroom,
  percentile,
  summarizeFrameTimings
} from "./lib/frameTimingMetrics.mjs";

test("frame timing summary reports interpolated p95 and p99 tails", () => {
  assert.equal(percentile([10, 20, 30, 40, 50], 0.95), 48);
  assert.deepEqual(summarizeFrameTimings([16, 16, 17, 34, 50], 60), {
    sampleCount: 5,
    frameBudgetMs: 16.67,
    p50FrameMs: 17,
    p95FrameMs: 46.8,
    p99FrameMs: 49.36,
    maximumFrameMs: 50,
    slowFrameRatio: 0.4,
    droppedFrameRatio: 0.4
  });
});

test("frame tail assessment calibrates against runner timing without hiding large stalls", () => {
  const baseline = { p95FrameMs: 30, p99FrameMs: 42 };
  assert.deepEqual(assessFrameTimingHeadroom({ p95FrameMs: 48, p99FrameMs: 82 }, baseline), []);
  assert.deepEqual(assessFrameTimingHeadroom({ p95FrameMs: 70, p99FrameMs: 120 }, baseline), [
    "p95 프레임 70ms",
    "p99 프레임 120ms"
  ]);
});
