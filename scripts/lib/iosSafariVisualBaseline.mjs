import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { classifyVisualDifference } from "./visualDiffClassifier.mjs";
import {
  analyzePixelDifference,
  mobileDeviceVisualBlurSigma,
  mobileDeviceVisualMaxChangedRatio,
  mobileDeviceVisualPixelThreshold
} from "./mobileDeviceVisualBaseline.mjs";

export const iosSafariVisualProfile = Object.freeze({
  id: "iphone-16-pro-ios-18-5-safari",
  deviceName: "iPhone 16 Pro",
  runtime: "iOS 18.5",
  requiredDirectionsScroll: 160
});

export const iosSafariVisualStates = Object.freeze([
  "game",
  "directions-text-200",
  "directions-text-200-middle",
  "directions-text-200-bottom",
  "game-landscape-chrome-expanded",
  "game-landscape-chrome-collapsed"
]);

export function iosSafariSentinelPixelRatio(pixelData, channels) {
  if (!Number.isInteger(channels) || channels < 3) {
    throw new Error("iOS Safari sentinel pixels require at least three channels");
  }
  let sentinelPixels = 0;
  let pixelCount = 0;
  for (let offset = 0; offset + 2 < pixelData.length; offset += channels) {
    pixelCount += 1;
    if (
      pixelData[offset] >= 200
      && pixelData[offset + 1] <= 80
      && pixelData[offset + 2] >= 200
    ) {
      sentinelPixels += 1;
    }
  }
  return pixelCount === 0 ? 0 : sentinelPixels / pixelCount;
}

export function iosSafariBaselinePath(rootDir, state) {
  return path.join(
    rootDir,
    "scripts/visual-baselines",
    `ios-safari-${iosSafariVisualProfile.id}-${state}.webp`
  );
}

export function iosSafariCurrentPath(outputDir, state) {
  return path.join(outputDir, `ios-safari-${iosSafariVisualProfile.id}-${state}-current.png`);
}

export async function compareIosSafariVisualBaseline({ rootDir, outputDir, state }) {
  const currentPath = iosSafariCurrentPath(outputDir, state);
  const baselinePath = iosSafariBaselinePath(rootDir, state);
  const diffPath = path.join(outputDir, `ios-safari-${iosSafariVisualProfile.id}-${state}-diff.png`);
  const [current, baseline, structuralCurrent, structuralBaseline] = await Promise.all([
    sharp(currentPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(baselinePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(currentPath).blur(mobileDeviceVisualBlurSigma).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(baselinePath).blur(mobileDeviceVisualBlurSigma).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  if (current.info.width !== baseline.info.width || current.info.height !== baseline.info.height) {
    throw new Error(`${state} 실제 iOS Safari 기준선 크기 불일치`);
  }
  const result = analyzePixelDifference(
    structuralCurrent.data,
    structuralBaseline.data,
    structuralCurrent.info.channels
  );
  const rawResult = analyzePixelDifference(current.data, baseline.data, current.info.channels);
  const diffPixels = Buffer.alloc(current.data.length);
  for (let offset = 0; offset < current.data.length; offset += current.info.channels) {
    const changed = Math.max(
      Math.abs(structuralCurrent.data[offset] - structuralBaseline.data[offset]),
      Math.abs(structuralCurrent.data[offset + 1] - structuralBaseline.data[offset + 1]),
      Math.abs(structuralCurrent.data[offset + 2] - structuralBaseline.data[offset + 2])
    ) > mobileDeviceVisualPixelThreshold;
    diffPixels.set(changed ? [190, 60, 86, 255] : [238, 234, 226, 255], offset);
  }
  await sharp(diffPixels, { raw: current.info }).png().toFile(diffPath);
  const comparison = {
    ...result,
    passed: result.changedRatio <= mobileDeviceVisualMaxChangedRatio,
    maxChangedRatio: mobileDeviceVisualMaxChangedRatio,
    rawChangedRatio: rawResult.changedRatio,
    rawMeanPixelDifference: rawResult.meanPixelDifference,
    baselinePath,
    currentPath,
    diffPath
  };
  return { ...comparison, classification: classifyVisualDifference(comparison) };
}

export async function approveIosSafariVisualBaselines({ rootDir, capturesDir, reason, captureReport }) {
  if (!reason?.trim()) throw new Error("실제 iOS Safari 기준선 승인 사유가 필요합니다.");
  const profiles = [];
  await mkdir(path.join(rootDir, "scripts/visual-baselines"), { recursive: true });
  for (const state of iosSafariVisualStates) {
    const currentPath = iosSafariCurrentPath(capturesDir, state);
    const baselinePath = iosSafariBaselinePath(rootDir, state);
    await sharp(currentPath).webp({ lossless: true, effort: 6 }).toFile(baselinePath);
    const buffer = await readFile(baselinePath);
    const metadata = await sharp(buffer).metadata();
    profiles.push({
      profileId: iosSafariVisualProfile.id,
      state,
      width: metadata.width,
      height: metadata.height,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      classification: classifyVisualDifference({}, { approved: true, reason })
    });
  }
  const metadata = {
    version: 2,
    approvedAt: new Date().toISOString(),
    reason: reason.trim(),
    profile: iosSafariVisualProfile,
    capture: captureReport,
    pixelThreshold: mobileDeviceVisualPixelThreshold,
    maxChangedRatio: mobileDeviceVisualMaxChangedRatio,
    comparisonMode: "gaussian-structural",
    blurSigma: mobileDeviceVisualBlurSigma,
    profiles
  };
  const metadataPath = path.join(rootDir, "scripts/visual-baselines/ios-safari-visual-regression.json");
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return { metadataPath, metadata };
}
