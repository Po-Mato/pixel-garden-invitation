import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  analyzePixelDifference,
  mobileDeviceVisualBlurSigma,
  mobileDeviceVisualMaxChangedRatio,
  mobileDeviceVisualPixelThreshold
} from "./mobileDeviceVisualBaseline.mjs";

export const androidChromeVisualProfile = Object.freeze({
  id: "pixel-7-api-35-chrome",
  deviceName: "Pixel 7",
  runtime: "Android 15 (API 35)",
  requiredDirectionsScroll: 0
});

export const androidChromeVisualStates = Object.freeze([
  "game",
  "directions"
]);

export function androidChromeBaselinePath(rootDir, state) {
  return path.join(
    rootDir,
    "scripts/visual-baselines",
    `android-chrome-${androidChromeVisualProfile.id}-${state}.webp`
  );
}

export function androidChromeCurrentPath(outputDir, state) {
  return path.join(outputDir, `android-chrome-${androidChromeVisualProfile.id}-${state}-current.png`);
}

export async function compareAndroidChromeVisualBaseline({ rootDir, outputDir, state }) {
  const currentPath = androidChromeCurrentPath(outputDir, state);
  const baselinePath = androidChromeBaselinePath(rootDir, state);
  const diffPath = path.join(outputDir, `android-chrome-${androidChromeVisualProfile.id}-${state}-diff.png`);
  const [current, baseline, structuralCurrent, structuralBaseline] = await Promise.all([
    sharp(currentPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(baselinePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(currentPath).blur(mobileDeviceVisualBlurSigma).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(baselinePath).blur(mobileDeviceVisualBlurSigma).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  if (current.info.width !== baseline.info.width || current.info.height !== baseline.info.height) {
    throw new Error(`${state} 실제 Android Chrome 기준선 크기 불일치`);
  }
  const result = analyzePixelDifference(
    structuralCurrent.data,
    structuralBaseline.data,
    structuralCurrent.info.channels
  );
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
  return {
    ...result,
    passed: result.changedRatio <= mobileDeviceVisualMaxChangedRatio,
    maxChangedRatio: mobileDeviceVisualMaxChangedRatio,
    baselinePath,
    currentPath,
    diffPath
  };
}

export async function approveAndroidChromeVisualBaselines({ rootDir, capturesDir, reason, captureReport }) {
  if (!reason?.trim()) throw new Error("실제 Android Chrome 기준선 승인 사유가 필요합니다.");
  const profiles = [];
  await mkdir(path.join(rootDir, "scripts/visual-baselines"), { recursive: true });
  for (const state of androidChromeVisualStates) {
    const currentPath = androidChromeCurrentPath(capturesDir, state);
    const baselinePath = androidChromeBaselinePath(rootDir, state);
    await sharp(currentPath).webp({ lossless: true, effort: 6 }).toFile(baselinePath);
    const buffer = await readFile(baselinePath);
    const metadata = await sharp(buffer).metadata();
    profiles.push({
      profileId: androidChromeVisualProfile.id,
      state,
      width: metadata.width,
      height: metadata.height,
      sha256: createHash("sha256").update(buffer).digest("hex")
    });
  }
  const metadata = {
    version: 1,
    approvedAt: new Date().toISOString(),
    reason: reason.trim(),
    profile: androidChromeVisualProfile,
    capture: captureReport,
    pixelThreshold: mobileDeviceVisualPixelThreshold,
    maxChangedRatio: mobileDeviceVisualMaxChangedRatio,
    comparisonMode: "gaussian-structural",
    blurSigma: mobileDeviceVisualBlurSigma,
    profiles
  };
  const metadataPath = path.join(rootDir, "scripts/visual-baselines/android-chrome-visual-regression.json");
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return { metadataPath, metadata };
}
