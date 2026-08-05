import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  analyzePixelDifference,
  compareMobileDeviceVisualBaseline,
  mobileDeviceBaselinePath,
  mobileDeviceVisualBlurSigma,
  mobileDeviceVisualMaxChangedRatioOverrides,
  mobileDeviceVisualBaselineProfiles,
  mobileDeviceVisualBaselineStates
} from "./lib/mobileDeviceVisualBaseline.mjs";

test("device visual baselines cover Chromium and WebKit mobile states including sheet scroll", () => {
  assert.deepEqual(mobileDeviceVisualBaselineProfiles, [
    "galaxy-s23-font-150",
    "iphone-15-dynamic-type",
    "iphone-15-webkit-dynamic-type",
    "iphone-15-webkit-text-200"
  ]);
  assert.deepEqual(mobileDeviceVisualBaselineStates, [
    "game",
    "directions-xlarge",
    "directions-xlarge-middle",
    "directions-xlarge-bottom"
  ]);
  assert.equal(mobileDeviceVisualBlurSigma, 2);
  assert.deepEqual(mobileDeviceVisualMaxChangedRatioOverrides, {
    "iphone-15-webkit-text-200": 0.018
  });
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

test("device visual structural comparison still catches shifted layout", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "mobile-device-visual-"));
  const width = 100;
  const height = 100;
  const renderCard = async (outputPath, left, format) => {
    const pixels = Buffer.alloc(width * height * 4, 255);
    for (let y = 20; y < 80; y += 1) {
      for (let x = left; x < left + 50; x += 1) {
        const offset = (y * width + x) * 4;
        pixels.set([65, 55, 58, 255], offset);
      }
    }
    await sharp(pixels, { raw: { width, height, channels: 4 } })[format]({ lossless: true }).toFile(outputPath);
  };

  try {
    const baselinePath = mobileDeviceBaselinePath(rootDir, "test-device", "game");
    const currentPath = path.join(rootDir, "current.png");
    const diffPath = path.join(rootDir, "diff.png");
    await mkdir(path.dirname(baselinePath), { recursive: true });
    await Promise.all([renderCard(baselinePath, 20, "webp"), renderCard(currentPath, 24, "png")]);
    const comparison = await compareMobileDeviceVisualBaseline({
      rootDir,
      profileId: "test-device",
      state: "game",
      currentPath,
      diffPath
    });
    assert.equal(comparison.passed, false);
    assert.ok(comparison.changedRatio > comparison.maxChangedRatio);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
