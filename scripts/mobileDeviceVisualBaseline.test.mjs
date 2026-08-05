import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzePixelDifference,
  mobileDeviceVisualBaselineProfiles,
  mobileDeviceVisualBaselineStates
} from "./lib/mobileDeviceVisualBaseline.mjs";

test("device visual baselines cover Galaxy and iPhone game and large-text states", () => {
  assert.deepEqual(mobileDeviceVisualBaselineProfiles, ["galaxy-s23-font-150", "iphone-15-dynamic-type"]);
  assert.deepEqual(mobileDeviceVisualBaselineStates, ["game", "directions-xlarge"]);
});

test("device visual difference ignores antialias noise and catches structural pixels", () => {
  const baseline = Buffer.from([100, 100, 100, 255, 100, 100, 100, 255]);
  const current = Buffer.from([120, 100, 100, 255, 180, 100, 100, 255]);
  const result = analyzePixelDifference(current, baseline, 4, 36);
  assert.equal(result.changedPixels, 1);
  assert.equal(result.changedRatio, 0.5);
  assert.equal(result.pixelCount, 2);
});

test("device visual difference rejects incompatible buffers", () => {
  assert.throws(() => analyzePixelDifference(Buffer.alloc(4), Buffer.alloc(8)), /matching lengths/);
});
