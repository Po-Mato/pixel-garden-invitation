import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const mobileDeviceVisualBaselineProfiles = Object.freeze([
  "galaxy-s23-font-150",
  "iphone-15-dynamic-type"
]);

export const mobileDeviceVisualBaselineStates = Object.freeze(["game", "directions-xlarge"]);
export const mobileDeviceVisualMaxChangedRatio = 0.015;
export const mobileDeviceVisualPixelThreshold = 36;

export function analyzePixelDifference(current, baseline, channels = 4, pixelThreshold = mobileDeviceVisualPixelThreshold) {
  if (!Buffer.isBuffer(current) || !Buffer.isBuffer(baseline) || current.length !== baseline.length) {
    throw new TypeError("Device visual buffers must have matching lengths");
  }
  let changedPixels = 0;
  let differenceSum = 0;
  const pixelCount = current.length / channels;
  for (let offset = 0; offset < current.length; offset += channels) {
    let maximumDifference = 0;
    for (let channel = 0; channel < Math.min(3, channels); channel += 1) {
      maximumDifference = Math.max(maximumDifference, Math.abs(current[offset + channel] - baseline[offset + channel]));
    }
    differenceSum += maximumDifference;
    if (maximumDifference > pixelThreshold) changedPixels += 1;
  }
  return {
    changedPixels,
    changedRatio: changedPixels / pixelCount,
    meanPixelDifference: differenceSum / pixelCount,
    pixelCount
  };
}

export function mobileDeviceBaselinePath(rootDir, profileId, state) {
  return path.join(rootDir, "scripts/visual-baselines", `mobile-device-${profileId}-${state}.webp`);
}

export async function compareMobileDeviceVisualBaseline({ rootDir, profileId, state, currentPath, diffPath }) {
  const baselinePath = mobileDeviceBaselinePath(rootDir, profileId, state);
  const [current, baseline] = await Promise.all([
    sharp(currentPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(baselinePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  if (current.info.width !== baseline.info.width || current.info.height !== baseline.info.height) {
    throw new Error(`${profileId}/${state} 기준선 크기 불일치`);
  }
  const result = analyzePixelDifference(current.data, baseline.data, current.info.channels);
  const diffPixels = Buffer.alloc(current.data.length);
  for (let offset = 0; offset < current.data.length; offset += current.info.channels) {
    const changed = Math.max(
      Math.abs(current.data[offset] - baseline.data[offset]),
      Math.abs(current.data[offset + 1] - baseline.data[offset + 1]),
      Math.abs(current.data[offset + 2] - baseline.data[offset + 2])
    ) > mobileDeviceVisualPixelThreshold;
    diffPixels.set(changed ? [190, 60, 86, 255] : [238, 234, 226, 255], offset);
  }
  await sharp(diffPixels, { raw: current.info }).png().toFile(diffPath);
  return {
    ...result,
    passed: result.changedRatio <= mobileDeviceVisualMaxChangedRatio,
    maxChangedRatio: mobileDeviceVisualMaxChangedRatio,
    baselinePath,
    currentPath,
    diffPath
  };
}

export async function approveMobileDeviceVisualBaselines({ rootDir, captures, reason, now = new Date() }) {
  if (!reason?.trim()) throw new Error("기기 시각 기준선 승인 사유가 필요합니다.");
  const baselineDir = path.join(rootDir, "scripts/visual-baselines");
  await mkdir(baselineDir, { recursive: true });
  const profiles = [];
  for (const capture of captures) {
    const baselinePath = mobileDeviceBaselinePath(rootDir, capture.profileId, capture.state);
    await sharp(capture.currentPath).webp({ lossless: true, effort: 6 }).toFile(baselinePath);
    const buffer = await readFile(baselinePath);
    const metadata = await sharp(buffer).metadata();
    profiles.push({
      profileId: capture.profileId,
      state: capture.state,
      width: metadata.width,
      height: metadata.height,
      sha256: createHash("sha256").update(buffer).digest("hex")
    });
  }
  const metadataPath = path.join(baselineDir, "mobile-device-visual-regression.json");
  const metadata = {
    version: 1,
    approvedAt: now.toISOString(),
    reason: reason.trim(),
    pixelThreshold: mobileDeviceVisualPixelThreshold,
    maxChangedRatio: mobileDeviceVisualMaxChangedRatio,
    profiles
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return { metadataPath, metadata };
}
