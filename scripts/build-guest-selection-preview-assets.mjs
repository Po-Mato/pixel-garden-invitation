#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const catalogPath = path.join(root, "character-assets/guest-character-presets.json");
const defaultWalkSourceRoot = path.join(
  root,
  "character-assets/reference/guest-flat-walk-sources/v1"
);
const defaultWalkSourceOverrideRoot = path.join(
  root,
  "character-assets/reference/guest-flat-walk-sources/v2"
);
const defaultWalkSourceFaceOverrideRoot = path.join(
  root,
  "character-assets/reference/guest-flat-walk-sources/v3"
);
const defaultWalkSourcePolishOverrideRoot = path.join(
  root,
  "character-assets/reference/guest-flat-walk-sources/v4"
);
const defaultWalkSourceFrontFaceOverrideRoot = path.join(
  root,
  "character-assets/reference/guest-flat-walk-sources/v5"
);
const defaultWalkSourceDepthOverrideRoot = path.join(
  root,
  "character-assets/reference/guest-depth-walk-sources/v6"
);
const defaultWalkSourceOpticalOverrideRoot = path.join(
  root,
  "character-assets/reference/guest-depth-walk-sources/v7"
);
const defaultCoupleDepthMasterSourceRoot = path.join(
  root,
  "character-assets/reference/guest-3d-master-sources/v1"
);
const defaultUnifiedRigSourceRoot = path.join(
  root,
  "character-assets/reference/guest-unified-rig-sources/v10"
);
const defaultFrameReviewRoot = path.join(
  root,
  ".superpowers/character-review/guest-unified-rig-v10-frames"
);
const defaultOutputRoot = path.join(root, "character-assets/source/guests-preview");
const defaultRuntimeOutputRoot = path.join(root, "character-assets/source/guests");
const defaultReviewPath = path.join(
  root,
  ".superpowers/character-review/guest-selection-preview-hd-ratio.png"
);
const directions = ["down", "left", "right", "up"];
const safeUnifiedSourceSet = "v10-alpha-safe-unified-rig";
const safeUnifiedDetectionMethod = "face-safe-three-head-rig";
const usesFaceSafeRig = (sourceSet) => sourceSet === safeUnifiedSourceSet;
// The long hair and ankle-length dress make guest-01 read taller than the
// geometric guide. Scale the complete head mass further before compressing the
// body so the final sprite reads as three-head-tall at its actual UI size.
const guest01OpticalHeadCompensation = 20;
// The tailored suit keeps a long, uninterrupted torso line at mobile size.
// Enlarge guest-03's complete head mass enough to preserve a visible three-head
// silhouette without changing the canonical transparent source artwork.
const guest03OpticalHeadCompensation = 10;
// The v10 guest-03 source has a 15px head-width swing between walk frames.
// Normalize every rendered head to its direction's shared silhouette width so
// changing gait never changes the perceived body ratio. Profiles keep the
// small natural hair-depth allowance needed to match the visible front face.
const guest03MaximumHeadWidthDelta = 1;
const guest03HeadWidthsByDirection = Object.freeze({
  down: 96,
  left: 105,
  right: 105,
  up: 96
});
const guest01AccessoryAnchorStep = Object.freeze({
  down: 1,
  left: 1,
  right: 1,
  up: 0
});
// Moving only the pixels below the dress hem disconnected the ankle from the
// calf and made the high heel visibly kink between frames. Keep the lower body
// centered and reuse one intact landing silhouette for both side-view feet.
const guest01LowerBodyStrideOffsets = Object.freeze({
  down: [0, 0, 0, 0],
  left: [0, 0, 0, 0],
  right: [0, 0, 0, 0],
  up: [0, 0, 0, 0]
});
const guest01StableSideFootReferenceStep = Object.freeze({
  left: 0,
  right: 0
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function detectGridBands(data, width, height, axis, expectedCount) {
  const length = axis === "x" ? width : height;
  const crossLength = axis === "x" ? height : width;
  const counts = new Uint32Array(length);
  for (let position = 0; position < length; position += 1) {
    for (let cross = 0; cross < crossLength; cross += 1) {
      const x = axis === "x" ? position : cross;
      const y = axis === "x" ? cross : position;
      if (data[(y * width + x) * 4 + 3] >= 8) counts[position] += 1;
    }
  }

  const runs = [];
  let start = -1;
  for (let position = 0; position <= length; position += 1) {
    const occupied = position < length && counts[position] >= 2;
    if (occupied && start < 0) start = position;
    if (!occupied && start >= 0) {
      runs.push({ start, end: position - 1 });
      start = -1;
    }
  }

  const mergeGap = axis === "x"
    ? Math.max(5, Math.round(length * 0.006))
    : 2;
  const merged = [];
  for (const run of runs) {
    const previous = merged.at(-1);
    if (previous && run.start - previous.end - 1 <= mergeGap) {
      previous.end = run.end;
    } else {
      merged.push({ ...run });
    }
  }

  const candidates = merged
    .map((run) => ({
      ...run,
      size: run.end - run.start + 1,
      pixels: counts.slice(run.start, run.end + 1).reduce((total, value) => total + value, 0)
    }))
    .filter((run) => run.size >= Math.round(length * 0.045))
    .sort((first, second) => second.pixels - first.pixels)
    .slice(0, expectedCount)
    .sort((first, second) => first.start - second.start);

  if (candidates.length !== expectedCount) {
    throw new Error(`${axis}축 캐릭터 그룹을 ${expectedCount}개 찾지 못했습니다.`);
  }
  return candidates;
}

async function loadWalkSheetGrid(input, expectedColumns = 3) {
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`${input} 보행 시트의 크기를 확인할 수 없습니다.`);
  }
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let borderOpaquePixels = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha <= 8) transparentPixels += 1;
      if (
        alpha > 8
        && (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1)
      ) borderOpaquePixels += 1;
    }
  }
  if (transparentPixels / (info.width * info.height) < 0.6) {
    throw new Error(`${input} 실제 투명 알파가 없는 원화는 사용할 수 없습니다.`);
  }
  if (borderOpaquePixels > 0) {
    throw new Error(`${input} 시트 가장자리에 제거되지 않은 배경 픽셀이 있습니다.`);
  }
  const columns = detectGridBands(data, info.width, info.height, "x", expectedColumns);
  const rows = detectGridBands(data, info.width, info.height, "y", 4);
  const horizontalBoundaries = [
    0,
    ...columns.slice(0, -1).map((band, index) =>
      Math.round((band.end + columns[index + 1].start) / 2)
    ),
    info.width
  ];
  const verticalBoundaries = [
    0,
    ...rows.slice(0, -1).map((band, index) =>
      Math.round((band.end + rows[index + 1].start) / 2)
    ),
    info.height
  ];
  return { data, info, horizontalBoundaries, verticalBoundaries };
}

async function extractWalkCell(grid, row, column) {
  const left = grid.horizontalBoundaries[column];
  const right = grid.horizontalBoundaries[column + 1];
  const top = grid.verticalBoundaries[row];
  const bottom = grid.verticalBoundaries[row + 1];
  return sharp(grid.data, { raw: grid.info })
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
}

async function loadCoupleDepthMasterFrames(guest, sourceRoot) {
  if (!sourceRoot) return null;
  const framesByDirection = {};
  for (const direction of directions) {
    framesByDirection[direction] = [];
    for (let column = 0; column < 3; column += 1) {
      const source = path.join(
        sourceRoot,
        guest,
        "pilot",
        "sources",
        direction,
        `step-${String(column + 1).padStart(2, "0")}-source.png`
      );
      await access(source);
      framesByDirection[direction].push(source);
    }
  }
  return framesByDirection;
}

async function writePng(file, input) {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(input)
    .png({ compressionLevel: 9 })
    .toFile(file);
}

async function resolveWalkSource({
  guest,
  walkSourceRoot,
  walkSourceOverrideRoot,
  walkSourceFaceOverrideRoot,
  walkSourcePolishOverrideRoot,
  walkSourceFrontFaceOverrideRoot,
  walkSourceOpticalOverrideRoot,
  walkSourceDepthOverrideRoot
}) {
  const filename = `${guest}-walk-sheet.png`;
  if (walkSourceOpticalOverrideRoot) {
    const opticalOverride = path.join(walkSourceOpticalOverrideRoot, filename);
    try {
      await access(opticalOverride);
      return { source: opticalOverride, sourceSet: "v7-optical-face-balance" };
    } catch {
      // Only guests with an approved optical correction override the reviewed v6 set.
    }
  }
  if (walkSourceDepthOverrideRoot) {
    const depthOverride = path.join(walkSourceDepthOverrideRoot, filename);
    try {
      await access(depthOverride);
      return { source: depthOverride, sourceSet: "v6-couple-depth-balance" };
    } catch {
      // Keep custom fixtures usable when they intentionally omit the reviewed v6 set.
    }
  }
  if (walkSourceFrontFaceOverrideRoot) {
    const frontFaceOverride = path.join(walkSourceFrontFaceOverrideRoot, filename);
    try {
      await access(frontFaceOverride);
      return { source: frontFaceOverride, sourceSet: "v5-front-face-balance" };
    } catch {
      // Only characters requiring an additional front/profile optical pass use v5.
    }
  }
  if (walkSourcePolishOverrideRoot) {
    const polishOverride = path.join(walkSourcePolishOverrideRoot, filename);
    try {
      await access(polishOverride);
      return { source: polishOverride, sourceSet: "v4-direction-motion-polish" };
    } catch {
      // v4 is intentionally complete, while the fallback keeps custom test fixtures usable.
    }
  }
  if (walkSourceFaceOverrideRoot) {
    const faceOverride = path.join(walkSourceFaceOverrideRoot, filename);
    try {
      await access(faceOverride);
      return { source: faceOverride, sourceSet: "v3-optical-face-rig" };
    } catch {
      // Guests already inside the optical face tolerance keep their reviewed source.
    }
  }
  if (walkSourceOverrideRoot) {
    const override = path.join(walkSourceOverrideRoot, filename);
    try {
      await access(override);
      return { source: override, sourceSet: "v2-optical-rig" };
    } catch {
      // Guests without a reviewed optical-rig redraw keep the approved v1 source.
    }
  }
  const source = path.join(walkSourceRoot, filename);
  await access(source);
  return { source, sourceSet: "v1-flat-three-head" };
}

async function alphaBounds(input, threshold = 12) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] <= threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("선택 화면 캐릭터의 불투명 픽셀을 찾지 못했습니다.");
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

function isFaceSkinPixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];
  return alpha > 128
    && red > 205
    && green > 145
    && blue > 115
    && red >= green
    && green >= blue
    && red - blue > 5
    && red - green < 90
    && green - blue < 75;
}

function verticalOverlap(first, second) {
  return Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) + 1;
}

function horizontalGap(first, second) {
  if (first.right < second.left) return second.left - first.right - 1;
  if (second.right < first.left) return first.left - second.right - 1;
  return 0;
}

function verticalGap(first, second) {
  if (first.bottom < second.top) return second.top - first.bottom - 1;
  if (second.bottom < first.top) return first.top - second.bottom - 1;
  return 0;
}

export async function detectFaceLandmark(input, policy, { knownHeadHeight } = {}) {
  const bounds = await alphaBounds(input);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(info.width * info.height);
  const scanBottom = Math.min(
    bounds.bottom,
    bounds.top + Math.round(policy.headHeight * 1.15)
  );
  for (let y = bounds.top; y <= scanBottom; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const pixel = y * info.width + x;
      if (isFaceSkinPixel(data, pixel * 4)) mask[pixel] = 1;
    }
  }

  const seen = new Uint8Array(mask.length);
  const queue = new Uint32Array(mask.length);
  const components = [];
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel] || seen[pixel]) continue;
    let head = 0;
    let tail = 0;
    let left = info.width;
    let top = info.height;
    let right = -1;
    let bottom = -1;
    seen[pixel] = 1;
    queue[tail] = pixel;
    tail += 1;
    while (head < tail) {
      const current = queue[head];
      head += 1;
      const x = current % info.width;
      const y = Math.floor(current / info.width);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nextX < 0 || nextX >= info.width || nextY < 0 || nextY >= info.height) continue;
        const next = nextY * info.width + nextX;
        if (!mask[next] || seen[next]) continue;
        seen[next] = 1;
        queue[tail] = next;
        tail += 1;
      }
    }
    components.push({ area: tail, left, top, right, bottom });
  }

  const candidates = components
    .filter((component) => (
      component.area >= Math.max(12, Math.round(policy.headWidth * 0.13))
      && component.bottom >= bounds.top + Math.round(policy.headHeight * 0.5)
      && component.bottom <= bounds.top + Math.round(policy.headHeight * 1.3)
      && component.top <= bounds.top + policy.headHeight
      && component.right - component.left + 1 >= 4
    ))
    .sort((first, second) => second.area - first.area);
  const primary = candidates[0];
  if (!primary) throw new Error("실제 얼굴 피부 영역과 턱선을 찾지 못했습니다.");
  const faceCluster = candidates.filter((component) => (
    component === primary
    || (
      horizontalGap(primary, component) <= 8
      && (verticalOverlap(primary, component) >= 4 || verticalGap(primary, component) <= 10)
    )
  ));
  const faceLeft = Math.min(...faceCluster.map((component) => component.left));
  const faceTop = Math.min(...faceCluster.map((component) => component.top));
  const faceRight = Math.max(...faceCluster.map((component) => component.right));
  const faceBottom = Math.max(...faceCluster.map((component) => component.bottom));
  const detectedHeadHeight = faceBottom - bounds.top + 1;
  if (!Number.isFinite(knownHeadHeight)
    && (detectedHeadHeight < Math.round(policy.headHeight * 0.55)
      || detectedHeadHeight > Math.round(policy.headHeight * 1.4))) {
    throw new Error(`실제 머리 높이 ${detectedHeadHeight}px가 안전한 교정 범위를 벗어났습니다.`);
  }
  return {
    characterTop: bounds.top,
    faceLeft,
    faceTop,
    faceRight,
    faceBottom,
    faceWidth: faceRight - faceLeft + 1,
    faceHeight: faceBottom - faceTop + 1,
    headHeight: Number.isFinite(knownHeadHeight) ? knownHeadHeight : detectedHeadHeight,
    detectedHeadHeight,
    componentCount: faceCluster.length,
    faceArea: faceCluster.reduce((total, component) => total + component.area, 0)
  };
}

async function transparentCanvas(width, height, composites) {
  return sharp({
    create: { width, height, channels: 4, background: "#00000000" }
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function samplePremultiplied(data, info, x, y) {
  const x0 = clamp(Math.floor(x), 0, info.width - 1);
  const x1 = clamp(x0 + 1, 0, info.width - 1);
  const y0 = clamp(Math.floor(y), 0, info.height - 1);
  const y1 = clamp(y0 + 1, 0, info.height - 1);
  const xWeight = clamp(x - x0, 0, 1);
  const yWeight = clamp(y - y0, 0, 1);
  const samples = [
    { offset: (y0 * info.width + x0) * 4, weight: (1 - xWeight) * (1 - yWeight) },
    { offset: (y0 * info.width + x1) * 4, weight: xWeight * (1 - yWeight) },
    { offset: (y1 * info.width + x0) * 4, weight: (1 - xWeight) * yWeight },
    { offset: (y1 * info.width + x1) * 4, weight: xWeight * yWeight }
  ];
  const alpha = samples.reduce((total, sample) => total + data[sample.offset + 3] * sample.weight, 0);
  if (alpha <= 0.5) return [0, 0, 0, 0];
  return [
    Math.round(samples.reduce(
      (total, sample) => total + data[sample.offset] * data[sample.offset + 3] * sample.weight,
      0
    ) / alpha),
    Math.round(samples.reduce(
      (total, sample) => total + data[sample.offset + 1] * data[sample.offset + 3] * sample.weight,
      0
    ) / alpha),
    Math.round(samples.reduce(
      (total, sample) => total + data[sample.offset + 2] * data[sample.offset + 3] * sample.weight,
      0
    ) / alpha),
    Math.round(alpha)
  ];
}

async function headBandWidth(input, policy, threshold = 12) {
  const bounds = await alphaBounds(input, threshold);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const headBottom = Math.min(info.height - 1, bounds.top + policy.headHeight - 1);
  let left = info.width;
  let right = -1;
  for (let y = bounds.top; y <= headBottom; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] <= threshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  if (right < left) throw new Error("선택 화면 캐릭터 머리 영역을 찾지 못했습니다.");
  return right - left + 1;
}

async function normalizeHeadWidth(
  input,
  policy,
  expectedWidth = policy.headWidth,
  tolerance = 1,
  maximumIterations = 3
) {
  let current = input;
  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    const measured = await headBandWidth(current, policy);
    if (Math.abs(measured - expectedWidth) <= tolerance) break;
    const scale = clamp(expectedWidth / measured, 0.8, 1.25);
    const bounds = await alphaBounds(current);
    const { data, info } = await sharp(current).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const output = Buffer.alloc(data.length);
    const centerX = (info.width - 1) / 2;
    const headBottom = bounds.top + policy.headHeight - 1;
    const transitionEnd = headBottom + 18;
    for (let y = 0; y < info.height; y += 1) {
      const rowScale = y <= headBottom
        ? scale
        : y >= transitionEnd
          ? 1
          : scale + (1 - scale) * ((y - headBottom) / (transitionEnd - headBottom));
      for (let x = 0; x < info.width; x += 1) {
        const sourceX = centerX + (x - centerX) / rowScale;
        if (sourceX < 0 || sourceX > info.width - 1) continue;
        output.set(samplePremultiplied(data, info, sourceX, y), (y * info.width + x) * 4);
      }
    }
    current = await sharp(output, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
  }
  return current;
}

async function normalizeSelectionPreviewBaseFrame(input, policy) {
  const bounds = await alphaBounds(input);
  const visible = await sharp(input).extract(bounds).png().toBuffer();
  const scale = policy.contentHeight / bounds.height;
  const width = Math.min(policy.source.width - 8, Math.max(2, Math.round(bounds.width * scale)));
  const resized = await sharp(visible)
    .resize({ width, height: policy.contentHeight, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const normalized = await transparentCanvas(policy.source.width, policy.source.height, [{
    input: resized,
    left: Math.round((policy.source.width - width) / 2),
    top: policy.footBaseline - policy.contentHeight + 1
  }]);
  return normalized;
}

async function normalizeFaceSafeThreeHeadRig(input, policy, sourceHeadHeight) {
  const bounds = await alphaBounds(input);
  if (sourceHeadHeight < 2 || sourceHeadHeight >= bounds.height - 2) {
    throw new Error("얼굴 비율 보존 리그를 적용할 머리·몸통 영역이 부족합니다.");
  }
  const visible = await sharp(input).extract(bounds).png().toBuffer();
  const uniformScale = policy.headHeight / sourceHeadHeight;
  const scaledWidth = Math.max(2, Math.round(bounds.width * uniformScale));
  const scaledHeight = Math.max(policy.headHeight + 2, Math.round(bounds.height * uniformScale));
  const scaled = await sharp(visible)
    .resize({ width: scaledWidth, height: scaledHeight, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const scaledHeadHeight = Math.min(policy.headHeight, scaledHeight - 2);
  const sourceBodyHeight = scaledHeight - scaledHeadHeight;
  const targetBodyHeight = policy.contentHeight - policy.headHeight;
  const [head, body] = await Promise.all([
    sharp(scaled)
      .extract({ left: 0, top: 0, width: scaledWidth, height: scaledHeadHeight })
      .png()
      .toBuffer(),
    sharp(scaled)
      .extract({
        left: 0,
        top: scaledHeadHeight,
        width: scaledWidth,
        height: sourceBodyHeight
      })
      .resize({ width: scaledWidth, height: targetBodyHeight, fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer()
  ]);
  const targetTop = policy.footBaseline - policy.contentHeight + 1;
  const left = Math.round((policy.source.width - scaledWidth) / 2);
  return transparentCanvas(policy.source.width, policy.source.height, [
    { input: head, left, top: targetTop },
    { input: body, left, top: targetTop + policy.headHeight }
  ]);
}

async function normalizeVerticalRig(input, policy, sourceHeadHeight) {
  const bounds = await alphaBounds(input);
  const sourceBodyHeight = bounds.height - sourceHeadHeight;
  const targetBodyHeight = policy.contentHeight - policy.headHeight;
  if (sourceHeadHeight < 2 || sourceBodyHeight < 2 || targetBodyHeight < 2) {
    throw new Error("3등신 세로 리그를 적용할 머리·몸통 영역이 부족합니다.");
  }
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(data.length);
  const targetTop = policy.footBaseline - policy.contentHeight + 1;
  for (let targetIndex = 0; targetIndex < policy.contentHeight; targetIndex += 1) {
    const sourceY = targetIndex < policy.headHeight
      ? bounds.top
        + targetIndex * ((sourceHeadHeight - 1) / (policy.headHeight - 1))
      : bounds.top + sourceHeadHeight
        + (targetIndex - policy.headHeight)
          * ((sourceBodyHeight - 1) / (targetBodyHeight - 1));
    const outputY = targetTop + targetIndex;
    for (let x = 0; x < info.width; x += 1) {
      output.set(
        samplePremultiplied(data, info, x, sourceY),
        (outputY * info.width + x) * 4
      );
    }
  }
  return sharp(output, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
}

export async function normalizeSelectionPreviewFrame(input, policy, sourceHeadHeight) {
  const normalized = await normalizeSelectionPreviewBaseFrame(input, policy);
  const detected = Number.isFinite(sourceHeadHeight)
    ? sourceHeadHeight
    : (await detectFaceLandmark(normalized, policy)).headHeight;
  const rigged = await normalizeVerticalRig(normalized, policy, detected);
  return normalizeHeadWidth(rigged, policy);
}

async function normalizeRuntimeFrame(input, selectionPolicy, runtimeSource) {
  const runtimePolicy = {
    source: runtimeSource,
    contentHeight: selectionPolicy.contentHeight / 2,
    headHeight: selectionPolicy.headHeight / 2,
    headWidth: selectionPolicy.headWidth / 2,
    footBaseline: selectionPolicy.footBaseline / 2
  };
  const bounds = await alphaBounds(input);
  const visible = await sharp(input).extract(bounds).png().toBuffer();
  const scale = runtimePolicy.contentHeight / bounds.height;
  const width = Math.min(
    runtimeSource.width - 4,
    Math.max(1, Math.round(bounds.width * scale))
  );
  const resized = await sharp(visible)
    .resize({
      width,
      height: runtimePolicy.contentHeight,
      fit: "fill",
      kernel: sharp.kernel.lanczos3
    })
    .png()
    .toBuffer();
  const normalized = await transparentCanvas(runtimeSource.width, runtimeSource.height, [{
    input: resized,
    left: Math.round((runtimeSource.width - width) / 2),
    top: runtimePolicy.footBaseline - runtimePolicy.contentHeight + 1
  }]);
  const { data: normalizedData, info: normalizedInfo } = await sharp(normalized)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const solidAlpha = Buffer.alloc(runtimeSource.width * runtimeSource.height);
  const edgeData = Buffer.from(normalizedData);
  for (let pixel = 0; pixel < solidAlpha.length; pixel += 1) {
    const offset = pixel * 4;
    const alpha = edgeData[offset + 3] >= 1 ? 255 : 0;
    solidAlpha[pixel] = alpha;
    edgeData[offset + 3] = alpha;
    if (alpha === 0) {
      edgeData[offset] = 0;
      edgeData[offset + 1] = 0;
      edgeData[offset + 2] = 0;
    }
  }
  for (let y = 0; y < runtimeSource.height; y += 1) {
    for (let x = 0; x < runtimeSource.width; x += 1) {
      const pixel = y * runtimeSource.width + x;
      if (solidAlpha[pixel] === 0) continue;
      let touchesTransparency = false;
      for (let offsetY = -1; offsetY <= 1 && !touchesTransparency; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const neighborX = x + offsetX;
          const neighborY = y + offsetY;
          if (
            neighborX < 0
            || neighborX >= runtimeSource.width
            || neighborY < 0
            || neighborY >= runtimeSource.height
            || solidAlpha[neighborY * runtimeSource.width + neighborX] === 0
          ) {
            touchesTransparency = true;
            break;
          }
        }
      }
      if (!touchesTransparency) continue;
      const offset = pixel * 4;
      edgeData[offset] = 47;
      edgeData[offset + 1] = 39;
      edgeData[offset + 2] = 43;
    }
  }
  const edgeNormalized = await sharp(edgeData, { raw: normalizedInfo })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const { data: outlineMask, info: outlineMaskInfo } = await sharp(solidAlpha, {
    raw: { width: runtimeSource.width, height: runtimeSource.height, channels: 1 }
  })
    .dilate(1)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const outlineData = Buffer.alloc(runtimeSource.width * runtimeSource.height * 4);
  for (let pixel = 0; pixel < solidAlpha.length; pixel += 1) {
    const offset = pixel * 4;
    outlineData[offset] = 47;
    outlineData[offset + 1] = 39;
    outlineData[offset + 2] = 43;
    outlineData[offset + 3] = outlineMask[pixel * outlineMaskInfo.channels];
  }
  const outline = await sharp(outlineData, {
    raw: { width: runtimeSource.width, height: runtimeSource.height, channels: 4 }
  })
    .png()
    .toBuffer();
  return transparentCanvas(runtimeSource.width, runtimeSource.height, [
    { input: outline, left: 0, top: 0 },
    { input: edgeNormalized, left: 0, top: 0 }
  ]);
}

async function runtimeCoreCenterX(input, runtimePolicy) {
  const bounds = await alphaBounds(input);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const coreBottom = Math.min(
    bounds.bottom,
    bounds.top + runtimePolicy.headHeight + Math.round(
      (runtimePolicy.contentHeight - runtimePolicy.headHeight) * 0.48
    )
  );
  let weightedX = 0;
  let alphaTotal = 0;
  for (let y = bounds.top; y <= coreBottom; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha < 20) continue;
      weightedX += x * alpha;
      alphaTotal += alpha;
    }
  }
  if (alphaTotal === 0) throw new Error("게임 캐릭터 상체 중심을 찾지 못했습니다.");
  return weightedX / alphaTotal;
}

async function translateFrameX(input, offsetX) {
  if (offsetX === 0) return input;
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(data.length);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const targetX = x + offsetX;
      if (targetX < 0 || targetX >= info.width) continue;
      const sourceOffset = (y * info.width + x) * 4;
      const targetOffset = (y * info.width + targetX) * 4;
      data.copy(output, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return sharp(output, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
}

async function stabilizeRuntimeWalkCycle(frames, runtimePolicy, maximumOffset = 2) {
  const centers = await Promise.all(frames.map((frame) => runtimeCoreCenterX(frame, runtimePolicy)));
  const neutralCenter = centers[1];
  return Promise.all(frames.map((frame, index) => {
    if (index === 1) return frame;
    const offsetX = clamp(
      Math.round(neutralCenter - centers[index]),
      -maximumOffset,
      maximumOffset
    );
    return translateFrameX(frame, offsetX);
  }));
}

async function inspectRuntimeMotion({ catalog, runtimeOutputRoot }) {
  const source = catalog.frame.source;
  const displayScale = catalog.frame.display.world.width / source.width;
  const runtimePolicy = {
    source,
    contentHeight: catalog.frame.selectionPreview.contentHeight / 2,
    headHeight: catalog.frame.selectionPreview.headHeight / 2,
    footBaseline: catalog.frame.selectionPreview.footBaseline / 2
  };
  const maximumCoreCenterDriftDisplayPx = 0.75;
  const presets = [];
  for (const preset of catalog.presets) {
    const walkPath = framePath(runtimeOutputRoot, preset.id, "walk");
    const directionMetrics = {};
    for (let row = 0; row < directions.length; row += 1) {
      const centers = [];
      const proportionHashes = [];
      for (let column = 0; column < catalog.frame.walk.columns; column += 1) {
        const frame = await sharp(walkPath)
          .extract({
            left: column * source.width,
            top: row * source.height,
            width: source.width,
            height: source.height
          })
          .png()
          .toBuffer();
        centers.push(await runtimeCoreCenterX(frame, runtimePolicy));
        if (preset.reference.walkSourceGuest === "guest-03") {
          proportionHashes.push(await headBandSha256(frame, runtimePolicy));
        }
      }
      directionMetrics[directions[row]] = {
        coreCenters: centers,
        maximumCoreCenterDriftDisplayPx: Math.max(
          ...centers.map((center) => Math.abs(center - centers[1]))
        ) * displayScale,
        ...(proportionHashes.length > 0
          ? {
              proportionHashes,
              proportionStable: new Set(proportionHashes).size === 1
            }
          : {})
      };
    }
    const proportionStable = preset.reference.walkSourceGuest === "guest-03"
      ? Object.values(directionMetrics).every((direction) => direction.proportionStable)
      : null;
    presets.push({
      id: preset.id,
      guest: preset.reference.walkSourceGuest,
      directions: directionMetrics,
      maximumCoreCenterDriftDisplayPx: Math.max(
        ...Object.values(directionMetrics).map((direction) =>
          direction.maximumCoreCenterDriftDisplayPx
        )
      ),
      ...(proportionStable === null ? {} : { proportionStable })
    });
  }
  const maximumMeasuredCoreCenterDriftDisplayPx = Math.max(
    ...presets.map((preset) => preset.maximumCoreCenterDriftDisplayPx)
  );
  const guest03Preset = presets.find((preset) => preset.guest === "guest-03");
  const guest03ProportionStable = !guest03Preset || guest03Preset.proportionStable === true;
  return {
    policy: {
      maximumCoreCenterDriftDisplayPx,
      measurementBand: "head and upper 48 percent of body",
      displayScale
    },
    summary: {
      maximumMeasuredCoreCenterDriftDisplayPx,
      guest03ProportionStable,
      passed: maximumMeasuredCoreCenterDriftDisplayPx <= maximumCoreCenterDriftDisplayPx
        && guest03ProportionStable
    },
    presets
  };
}

async function replaceUpperBandWithMirroredReference(target, reference, policy) {
  const [{ data: targetData, info }, { data: mirroredData }] = await Promise.all([
    sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(reference).flop().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  const output = Buffer.from(targetData);
  const characterTop = policy.footBaseline - policy.contentHeight + 1;
  const transitionBottom = Math.min(
    info.height - 1,
    characterTop + policy.headHeight + 12
  );
  for (let y = characterTop; y <= transitionBottom; y += 1) {
    const rowOffset = y * info.width * 4;
    mirroredData.copy(output, rowOffset, rowOffset, rowOffset + info.width * 4);
  }
  return sharp(output, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
}

async function harmonizeProfileHeads(framesByDirection, policy) {
  for (let column = 0; column < framesByDirection.left.length; column += 1) {
    const left = framesByDirection.left[column];
    const right = framesByDirection.right[column];
    const [leftFace, rightFace] = await Promise.all([
      detectFaceLandmark(left, policy),
      detectFaceLandmark(right, policy)
    ]);
    const useLeft = leftFace.faceWidth > rightFace.faceWidth
      || (leftFace.faceWidth === rightFace.faceWidth && leftFace.faceArea >= rightFace.faceArea);
    if (useLeft) {
      framesByDirection.right[column] = await replaceUpperBandWithMirroredReference(
        right,
        left,
        policy
      );
    } else {
      framesByDirection.left[column] = await replaceUpperBandWithMirroredReference(
        left,
        right,
        policy
      );
    }
  }
}

async function normalizeVisibleFaceWidth(input, policy, expectedWidth) {
  let current = input;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const landmark = await detectFaceLandmark(current, policy);
    if (Math.abs(landmark.faceWidth - expectedWidth) <= 1) break;
    const scale = clamp(expectedWidth / landmark.faceWidth, 0.86, 1.16);
    const bounds = await alphaBounds(current);
    const { data, info } = await sharp(current)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const output = Buffer.alloc(data.length);
    const centerX = (landmark.faceLeft + landmark.faceRight) / 2;
    const headBottom = bounds.top + policy.headHeight - 1;
    const transitionEnd = headBottom + 18;
    for (let y = 0; y < info.height; y += 1) {
      const rowScale = y <= headBottom
        ? scale
        : y >= transitionEnd
          ? 1
          : scale + (1 - scale) * ((y - headBottom) / (transitionEnd - headBottom));
      for (let x = 0; x < info.width; x += 1) {
        const sourceX = centerX + (x - centerX) / rowScale;
        if (sourceX < 0 || sourceX > info.width - 1) continue;
        output.set(samplePremultiplied(data, info, sourceX, y), (y * info.width + x) * 4);
      }
    }
    current = await sharp(output, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
  }
  return current;
}

async function balanceVisibleFaceWidths(framesByDirection, policy) {
  const visibleDirections = ["down", "left", "right"];
  const widths = [];
  for (const direction of visibleDirections) {
    for (const frame of framesByDirection[direction]) {
      widths.push((await detectFaceLandmark(frame, policy)).faceWidth);
    }
  }
  const expectedWidth = Math.round(median(widths));
  for (const direction of visibleDirections) {
    for (let column = 0; column < framesByDirection[direction].length; column += 1) {
      framesByDirection[direction][column] = await normalizeVisibleFaceWidth(
        framesByDirection[direction][column],
        policy,
        expectedWidth
      );
    }
  }
}

async function balanceOpticalFrontFaceWidth(framesByDirection, policy) {
  const profileWidths = [];
  for (const direction of ["left", "right"]) {
    for (const frame of framesByDirection[direction]) {
      profileWidths.push((await detectFaceLandmark(frame, policy)).faceWidth);
    }
  }
  // A front face exposes both cheeks, so a slightly narrower pixel width produces
  // the same perceived area as a profile without shrinking the three-head-tall rig.
  const expectedFrontWidth = Math.round(median(profileWidths) * 0.96);
  for (let column = 0; column < framesByDirection.down.length; column += 1) {
    framesByDirection.down[column] = await normalizeVisibleFaceWidth(
      framesByDirection.down[column],
      policy,
      expectedFrontWidth
    );
  }
}

async function softenMasterFrontFaceWidth(framesByDirection, policy, guest) {
  if (guest !== "guest-01") return;
  for (let column = 0; column < framesByDirection.down.length; column += 1) {
    const landmark = await detectFaceLandmark(framesByDirection.down[column], policy, {
      knownHeadHeight: policy.headHeight
    });
    framesByDirection.down[column] = await normalizeVisibleFaceWidth(
      framesByDirection.down[column],
      policy,
      Math.round(landmark.faceWidth * 0.91) - 1
    );
  }
}

function median(values) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function frameSha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function guest01UpperBodyBandBottom(policy) {
  const characterTop = policy.footBaseline - policy.contentHeight + 1;
  const bodyHeight = policy.contentHeight - policy.headHeight;
  return characterTop + policy.headHeight + Math.round(bodyHeight * 0.79) - 1;
}

async function upperBodyBandSha256(input, policy) {
  const bottom = guest01UpperBodyBandBottom(policy);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return createHash("sha256")
    .update(data.subarray(0, (bottom + 1) * info.width * info.channels))
    .digest("hex");
}

function lowerStrideBandTop(policy) {
  const characterTop = policy.footBaseline - policy.contentHeight + 1;
  const bodyHeight = policy.contentHeight - policy.headHeight;
  return characterTop + policy.headHeight + Math.round(bodyHeight * 0.62);
}

async function lowerStrideBandSha256(input, policy) {
  const top = lowerStrideBandTop(policy);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const silhouette = Buffer.alloc((info.height - top) * info.width);
  let target = 0;
  for (let y = top; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      silhouette[target] = data[(y * info.width + x) * info.channels + 3] > 12 ? 1 : 0;
      target += 1;
    }
  }
  return createHash("sha256").update(silhouette).digest("hex");
}

async function mirroredLowerStrideBandSha256(input, policy) {
  return lowerStrideBandSha256(await sharp(input).flop().png().toBuffer(), policy);
}

async function frameDifferenceFromRow(first, second, top) {
  const [firstRaw, secondRaw] = await Promise.all([
    sharp(first).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(second).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  if (
    firstRaw.info.width !== secondRaw.info.width
    || firstRaw.info.height !== secondRaw.info.height
  ) {
    throw new Error("반대 발 보행 프레임 규격이 일치하지 않습니다.");
  }
  let unionPixels = 0;
  let alphaDifferencePixels = 0;
  let rgbaDifference = 0;
  for (let y = top; y < firstRaw.info.height; y += 1) {
    for (let x = 0; x < firstRaw.info.width; x += 1) {
      const offset = (y * firstRaw.info.width + x) * firstRaw.info.channels;
      const firstOpaque = firstRaw.data[offset + 3] > 12;
      const secondOpaque = secondRaw.data[offset + 3] > 12;
      if (!firstOpaque && !secondOpaque) continue;
      unionPixels += 1;
      if (firstOpaque !== secondOpaque) alphaDifferencePixels += 1;
      for (let channel = 0; channel < 4; channel += 1) {
        rgbaDifference += Math.abs(
          firstRaw.data[offset + channel] - secondRaw.data[offset + channel]
        );
      }
    }
  }
  return {
    alpha: unionPixels === 0 ? 0 : alphaDifferencePixels / unionPixels,
    rgba: unionPixels === 0 ? 0 : rgbaDifference / (unionPixels * 4 * 255)
  };
}

async function lowerStrideDifference(first, second, policy) {
  return frameDifferenceFromRow(first, second, lowerStrideBandTop(policy));
}

async function neutralFootDifference(first, second, policy) {
  return frameDifferenceFromRow(first, second, neutralFootBandTop(policy));
}

async function fullFrameDifference(first, second) {
  return frameDifferenceFromRow(first, second, 0);
}

function neutralFootBandTop(policy) {
  const characterTop = policy.footBaseline - policy.contentHeight + 1;
  const bodyHeight = policy.contentHeight - policy.headHeight;
  return characterTop + policy.headHeight + Math.round(bodyHeight * 0.82);
}

async function neutralFootBandSha256(input, policy) {
  const top = neutralFootBandTop(policy);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const silhouette = Buffer.alloc((info.height - top) * info.width);
  let target = 0;
  for (let y = top; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      silhouette[target] = data[(y * info.width + x) * info.channels + 3] > 12 ? 1 : 0;
      target += 1;
    }
  }
  return createHash("sha256").update(silhouette).digest("hex");
}

async function neutralFootSpan(input, policy) {
  const top = neutralFootBandTop(policy);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width;
  let right = -1;
  for (let y = top; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= 12) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return right >= left ? right - left + 1 : 0;
}

async function mirroredNeutralFootBandSha256(input, policy) {
  return neutralFootBandSha256(await sharp(input).flop().png().toBuffer(), policy);
}

async function alphaSilhouetteSha256(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const silhouette = Buffer.alloc(info.width * info.height);
  for (let pixel = 0; pixel < silhouette.length; pixel += 1) {
    silhouette[pixel] = data[pixel * info.channels + 3] > 12 ? 1 : 0;
  }
  return createHash("sha256").update(silhouette).digest("hex");
}

async function rgbaRowsSha256(input, endRowExclusive) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return createHash("sha256")
    .update(data.subarray(0, endRowExclusive * info.width * info.channels))
    .digest("hex");
}

function stabilizeNeutralPose(framesByDirection) {
  for (const direction of directions) {
    framesByDirection[direction][3] = framesByDirection[direction][1];
  }
}

async function canonicalizeRightDirection(framesByDirection) {
  framesByDirection.right = await Promise.all(
    framesByDirection.left.map((frame) => sharp(frame).flop().png({ compressionLevel: 9 }).toBuffer())
  );
}

function guest03ProportionBandBottom(policy) {
  const targetTop = policy.footBaseline - policy.contentHeight + 1;
  return Math.min(
    policy.source.height - 1,
    targetTop + Math.round(policy.headHeight * 1.15)
  );
}

function guest03LegPhaseBandTop(policy) {
  const characterTop = policy.footBaseline - policy.contentHeight + 1;
  const bodyHeight = policy.contentHeight - policy.headHeight;
  return characterTop + policy.headHeight + Math.round(bodyHeight * 0.46);
}

async function guest03UpperSuitSha256(input, policy) {
  const bottom = guest03LegPhaseBandTop(policy) - 1;
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return createHash("sha256")
    .update(data.subarray(0, (bottom + 1) * info.width * info.channels))
    .digest("hex");
}

async function emphasizeGuest03LegPhase(input, policy, direction, phase) {
  const beforeSuit = await guest03UpperSuitSha256(input, policy);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const top = guest03LegPhaseBandTop(policy);
  const centerX = (info.width - 1) / 2;
  const transitionRows = 14;
  const mirroredDirection = direction === "right" || direction === "up";
  const phaseDirection = (phase < 2 ? -1 : 1) * (mirroredDirection ? -1 : 1);
  for (let y = top; y < info.height; y += 1) {
    const verticalStrength = clamp((y - top + 1) / transitionRows, 0, 1);
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const alpha = data[offset + 3];
      const isCoolSuitPixel = alpha > 12
        && red < 120
        && green < 135
        && blue < 155
        && blue >= red * 0.72;
      if (!isCoolSuitPixel) continue;
      const horizontalDivisor = direction === "up" ? 12 : 32;
      const horizontal = clamp((x - centerX) / horizontalDivisor, -1, 1);
      const phaseContrast = direction === "up"
        ? 0.32
        : direction === "left" || direction === "right"
          ? 0.34
          : 0.24;
      const factor = 0.94 + phaseDirection * horizontal * phaseContrast * verticalStrength;
      data[offset] = clamp(Math.round(red * factor), 0, 255);
      data[offset + 1] = clamp(Math.round(green * factor), 0, 255);
      data[offset + 2] = clamp(Math.round(blue * factor), 0, 255);
    }
  }
  const adjusted = await sharp(data, { raw: info })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const afterSuit = await guest03UpperSuitSha256(adjusted, policy);
  if (beforeSuit !== afterSuit) {
    throw new Error(`guest-03/${direction}/step-${phase + 1} 정장 상단이 변경됐습니다.`);
  }
  return adjusted;
}

async function emphasizeGuest03LegPhases(framesByDirection, policy) {
  for (const direction of directions) {
    for (let phase = 0; phase < framesByDirection[direction].length; phase += 1) {
      framesByDirection[direction][phase] = await emphasizeGuest03LegPhase(
        framesByDirection[direction][phase],
        policy,
        direction,
        phase
      );
    }
  }
}

async function headBandSha256(input, policy) {
  const headBandBottom = guest03ProportionBandBottom(policy);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return createHash("sha256")
    .update(data.subarray(0, (headBandBottom + 1) * info.width * info.channels))
    .digest("hex");
}

async function lockGuest03HeadBand(framesByDirection, policy) {
  for (const direction of directions) {
    framesByDirection[direction] = await lockProportionBandAcrossFrames(
      framesByDirection[direction],
      policy
    );
  }
}

async function lockProportionBandAcrossFrames(frames, policy) {
  const headBandBottom = guest03ProportionBandBottom(policy);
  const { data: referenceData, info } = await sharp(frames[1])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const byteLength = (headBandBottom + 1) * info.width * info.channels;
  return Promise.all(frames.map(async (frame) => {
    const { data: targetData } = await sharp(frame)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    referenceData.copy(targetData, 0, 0, byteLength);
    return sharp(targetData, { raw: info })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }));
}

async function lockGuest01UpperBodyAndBag(framesByDirection, policy) {
  const bottom = guest01UpperBodyBandBottom(policy);
  for (const direction of directions) {
    const reference = framesByDirection[direction][guest01AccessoryAnchorStep[direction]];
    const { data: referenceData, info } = await sharp(reference)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const byteLength = (bottom + 1) * info.width * info.channels;
    for (let column = 0; column < framesByDirection[direction].length; column += 1) {
      const { data: targetData } = await sharp(framesByDirection[direction][column])
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      referenceData.copy(targetData, 0, 0, byteLength);
      framesByDirection[direction][column] = await sharp(targetData, { raw: info })
        .png({ compressionLevel: 9 })
        .toBuffer();
    }
  }
}

async function replaceGuest01FootBand(target, reference, policy) {
  const lowerBodyTop = guest01UpperBodyBandBottom(policy) + 1;
  const [{ data: targetData, info }, { data: referenceData }] = await Promise.all([
    sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(reference).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  const offset = lowerBodyTop * info.width * info.channels;
  referenceData.copy(targetData, offset, offset);
  return sharp(targetData, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
}

async function emphasizeGuest01FootPhase(input, policy, direction, phase) {
  const beforeUpperBody = await upperBodyBandSha256(input, policy);
  const lowerBodyTop = guest01UpperBodyBandBottom(policy) + 1;
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const centerX = (info.width - 1) / 2;
  const mirroredDirection = direction === "right" || direction === "up";
  const phaseDirection = (phase < 2 ? -1 : 1) * (mirroredDirection ? -1 : 1);
  const phaseContrast = direction === "left" || direction === "right" ? 0.16 : 0.1;
  for (let y = lowerBodyTop; y < info.height; y += 1) {
    const verticalStrength = clamp((y - lowerBodyTop + 1) / 10, 0, 1);
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      if (data[offset + 3] <= 12) continue;
      const horizontal = clamp((x - centerX) / 34, -1, 1);
      const factor = 0.97 + phaseDirection * horizontal * phaseContrast * verticalStrength;
      data[offset] = clamp(Math.round(data[offset] * factor), 0, 255);
      data[offset + 1] = clamp(Math.round(data[offset + 1] * factor), 0, 255);
      data[offset + 2] = clamp(Math.round(data[offset + 2] * factor), 0, 255);
    }
  }
  const adjusted = await sharp(data, { raw: info })
    .png({ compressionLevel: 9 })
    .toBuffer();
  if (beforeUpperBody !== await upperBodyBandSha256(adjusted, policy)) {
    throw new Error(`guest-01/${direction}/step-${phase + 1} 상체·원피스·가방이 변경됐습니다.`);
  }
  return adjusted;
}

async function stabilizeGuest01FootGeometry(framesByDirection, policy) {
  for (const direction of ["left", "right"]) {
    const reference = framesByDirection[direction][guest01StableSideFootReferenceStep[direction]];
    for (const phase of [0, 2]) {
      framesByDirection[direction][phase] = await replaceGuest01FootBand(
        framesByDirection[direction][phase],
        reference,
        policy
      );
    }
  }
  for (const direction of directions) {
    for (let phase = 0; phase < framesByDirection[direction].length; phase += 1) {
      framesByDirection[direction][phase] = await emphasizeGuest01FootPhase(
        framesByDirection[direction][phase],
        policy,
        direction,
        phase
      );
    }
  }
}

async function inspectFrame(input, policy, { direction, guest, rigFrame, sourceSet }) {
  const bounds = await alphaBounds(input);
  const measuredHeadWidth = await headBandWidth(input, policy);
  const landmark = direction === "up"
    ? null
    : await detectFaceLandmark(input, policy, {
        knownHeadHeight: sourceSet === "v8-couple-depth-master"
          || usesFaceSafeRig(sourceSet)
          ? policy.headHeight
          : undefined
      });
  const measuredHeadHeight = landmark?.headHeight ?? policy.headHeight;
  const expectedHeadWidth = guest === "guest-03"
    ? guest03HeadWidthsByDirection[direction]
    : policy.headWidth;
  const measuredBodyHeight = bounds.height - measuredHeadHeight;
  const checksum = frameSha256(input);
  const opticalHeadCompensation = rigFrame.sourceMeasuredHeadHeight - rigFrame.sourceHeadHeight;
  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    bottom: bounds.bottom,
    characterWidth: bounds.width,
    characterHeight: bounds.height,
    characterCenterX: (bounds.left + bounds.right) / 2,
    measuredHeadHeight,
    measuredBodyHeight,
    measuredBodyToHeadRatio: measuredBodyHeight / measuredHeadHeight,
    headHeightDelta: measuredHeadHeight - policy.headHeight,
    headWidth: measuredHeadWidth,
    expectedHeadWidth,
    headWidthDelta: measuredHeadWidth - expectedHeadWidth,
    visibleFaceWidth: landmark?.faceWidth ?? null,
    visibleFaceHeight: landmark?.faceHeight ?? null,
    visibleFaceArea: landmark?.faceArea ?? null,
    visibleFaceTop: landmark?.faceTop ?? null,
    visibleFaceBottom: landmark?.faceBottom ?? null,
    visibleFaceCenterYRatio: landmark
      ? (((landmark.faceTop + landmark.faceBottom) / 2) - bounds.top) / policy.headHeight
      : null,
    visibleFaceBottomYRatio: landmark
      ? (landmark.faceBottom - bounds.top) / policy.headHeight
      : null,
    sourceHeadHeight: rigFrame.sourceHeadHeight,
    sourceMeasuredHeadHeight: rigFrame.sourceMeasuredHeadHeight,
    ...(opticalHeadCompensation > 0
      ? {
          opticalHeadCompensation,
          estimatedOpticalHeadHeight:
            policy.headHeight * rigFrame.sourceMeasuredHeadHeight / rigFrame.sourceHeadHeight,
          upperBodyBandSha256: await upperBodyBandSha256(input, policy)
        }
      : {}),
    ...(guest === "guest-03"
      ? { headBandSha256: await headBandSha256(input, policy) }
      : {}),
    sourceDetectionMethod: rigFrame.sourceDetectionMethod,
    sourceFaceBottom: rigFrame.sourceFaceBottom,
    lowerStrideBandSha256: await lowerStrideBandSha256(input, policy),
    mirroredLowerStrideBandSha256: await mirroredLowerStrideBandSha256(input, policy),
    neutralFootBandSha256: await neutralFootBandSha256(input, policy),
    mirroredNeutralFootBandSha256: await mirroredNeutralFootBandSha256(input, policy),
    neutralFootSpan: await neutralFootSpan(input, policy),
    alphaSilhouetteSha256: await alphaSilhouetteSha256(input),
    neutralUpperBodyBandSha256: await rgbaRowsSha256(input, neutralFootBandTop(policy)),
    frameSha256: checksum,
    rigHashMatches: !rigFrame.frameSha256 || rigFrame.frameSha256 === checksum
  };
}

function framePath(rootPath, presetId, kind) {
  return path.join(rootPath, `${presetId}__${kind}.png`);
}

async function inspectPreviewSheets({ catalog, outputRoot, sourceRig }) {
  const policy = catalog.frame.selectionPreview;
  const minimumFrontToProfileFaceWidthRatio = 0.92;
  const maximumFrontToProfileFaceWidthRatio = 1.08;
  const maximumFrontToProfileFaceAreaRatio = 1.5;
  const maximumFrontToProfileFaceAreaRatioByGuest = Object.freeze({
    "guest-01": 1.25
  });
  const maximumMasterFrontToProfileFaceWidthRatio = 1.6;
  const maximumMasterFrontToProfileFaceAreaRatio = 1.8;
  const maximumMasterLeftRightFaceWidthDifferenceRatio = 0.12;
  const maximumLeftRightFaceWidthDifferenceRatio = 0.1;
  const maximumHeadWidthDelta = 2;
  const minimumFrontToProfileHeadWidthRatio = 0.97;
  const maximumFrontToProfileHeadWidthRatio = 1.03;
  const maximumFacialLandmarkVerticalSpreadRatio = 0.15;
  const maximumStrideSilhouetteSymmetryRatio = 0.12;
  const maximumLeftRightStrideExpansionDifferenceRatio = 0.09;
  const maximumStrideCenterDrift = 4;
  const maximumStepBaselineSpread = 1;
  const maximumGuest01SideOppositeFootAlphaDifference = 0.005;
  const minimumGuest01OppositeFootRgbaDifference = 0.012;
  const minimumGuest03OppositeFootAlphaDifference = 0.02;
  const minimumGuest03OppositeFootRgbaDifference = 0.055;
  const minimumGenericSideOppositeFootAlphaDifference = 0.1;
  const minimumGenericSideOppositeFootRgbaDifference = 0.09;
  const minimumGenericFrontBackOppositeFootAlphaDifference = 0.025;
  const minimumGenericFrontBackOppositeFootRgbaDifference = 0.03;
  const maximumCanonicalDirectionDifference = 0;
  const minimumSafeBodyToHeadRatio = 1.75;
  const maximumSafeBodyToHeadRatio = 2.25;
  const maximumSafeStepFaceWidthSpreadRatio = 0.16;
  const minimumSafeFrontToProfileFaceWidthRatio = 1;
  const maximumSafeFrontToProfileFaceWidthRatio = 1.6;
  const maximumSafeFrontToProfileFaceWidthRatioByGuest = Object.freeze({
    "guest-01": 1.35,
    "guest-03": 1.58
  });
  const maximumSafeFrontToProfileFaceAreaRatio = 2.25;
  const maximumSafeFrontToProfileFaceAreaRatioByGuest = Object.freeze({
    "guest-01": 1.65,
    "guest-03": 1.7
  });
  const minimumSafeFrontToProfileHeadWidthRatio = 0.8;
  const maximumSafeFrontToProfileHeadWidthRatio = 1.24;
  const maximumSafeLeftRightHeadWidthDifferenceRatio = 0.02;
  const maximumSafeLeftRightFaceWidthDifferenceRatio = 0.02;
  const presets = [];
  let frameCount = 0;
  for (const preset of catalog.presets) {
    const walkPath = framePath(outputRoot, preset.id, "walk");
    const idlePath = framePath(outputRoot, preset.id, "idle");
    const walkMetadata = await sharp(walkPath).metadata();
    const idleMetadata = await sharp(idlePath).metadata();
    if (
      walkMetadata.width !== policy.walk.sheet.width
      || walkMetadata.height !== policy.walk.sheet.height
      || idleMetadata.width !== policy.idle.sheet.width
      || idleMetadata.height !== policy.idle.sheet.height
    ) {
      throw new Error(`${preset.id} 선택 화면 고해상도 시트 규격이 잘못됐습니다.`);
    }
    const directionMetrics = {};
    const frameBuffersByDirection = {};
    const presetRig = sourceRig[preset.id];
    if (!presetRig) throw new Error(`${preset.id} 방향별 3등신 리그 정보가 없습니다.`);
    for (let row = 0; row < directions.length; row += 1) {
      const direction = directions[row];
      directionMetrics[direction] = [];
      frameBuffersByDirection[direction] = [];
      for (let column = 0; column < catalog.frame.walk.columns; column += 1) {
        const frame = await sharp(walkPath)
          .extract({
            left: column * policy.source.width,
            top: row * policy.source.height,
            width: policy.source.width,
            height: policy.source.height
          })
          .png()
          .toBuffer();
        const rigFrame = presetRig.directions[direction]?.[column];
        if (!rigFrame) {
          throw new Error(`${preset.id}/${direction}/step-${column + 1} 3등신 리그 정보가 없습니다.`);
        }
        directionMetrics[direction].push(await inspectFrame(frame, policy, {
          direction,
          guest: preset.reference.walkSourceGuest,
          rigFrame,
          sourceSet: presetRig.sourceSet
        }));
        frameBuffersByDirection[direction].push(frame);
        frameCount += 1;
      }
    }
    const directionStepDifferences = [];
    for (let column = 0; column < catalog.frame.walk.columns; column += 1) {
      const mirroredRight = await sharp(frameBuffersByDirection.right[column])
        .flop()
        .png({ compressionLevel: 9 })
        .toBuffer();
      directionStepDifferences.push(await fullFrameDifference(
        frameBuffersByDirection.left[column],
        mirroredRight
      ));
    }
    const maximumDirectionAlphaDifference = Math.max(
      ...directionStepDifferences.map((difference) => difference.alpha)
    );
    const maximumDirectionRgbaDifference = Math.max(
      ...directionStepDifferences.map((difference) => difference.rgba)
    );
    const directionConsistency = {
      stepDifferences: directionStepDifferences,
      maximumAlphaDifference: maximumDirectionAlphaDifference,
      maximumRgbaDifference: maximumDirectionRgbaDifference,
      required: preset.reference.walkSourceGuest !== "guest-01",
      passed: preset.reference.walkSourceGuest === "guest-01" || (
        maximumDirectionAlphaDifference <= maximumCanonicalDirectionDifference
        && maximumDirectionRgbaDifference <= maximumCanonicalDirectionDifference
      )
    };
    const opticalFrames = Object.fromEntries(directions.map((direction) => {
      const seen = new Set();
      return [direction, directionMetrics[direction].filter((frame) => {
        const opticalSignature = [
          frame.headWidth,
          frame.visibleFaceWidth,
          frame.visibleFaceHeight,
          frame.visibleFaceArea,
          frame.visibleFaceCenterYRatio
        ].join(":");
        if (seen.has(opticalSignature)) return false;
        seen.add(opticalSignature);
        return true;
      })];
    }));
    const downMedianFaceWidth = median(
      opticalFrames.down.map((frame) => frame.visibleFaceWidth)
    );
    const leftMedianFaceWidth = median(
      opticalFrames.left.map((frame) => frame.visibleFaceWidth)
    );
    const rightMedianFaceWidth = median(
      opticalFrames.right.map((frame) => frame.visibleFaceWidth)
    );
    const profileMedianFaceWidth = (leftMedianFaceWidth + rightMedianFaceWidth) / 2;
    const downMedianFaceArea = median(
      opticalFrames.down.map((frame) => frame.visibleFaceArea)
    );
    const leftMedianFaceArea = median(
      opticalFrames.left.map((frame) => frame.visibleFaceArea)
    );
    const rightMedianFaceArea = median(
      opticalFrames.right.map((frame) => frame.visibleFaceArea)
    );
    const profileMedianFaceArea = (leftMedianFaceArea + rightMedianFaceArea) / 2;
    const downMedianHeadWidth = median(
      opticalFrames.down.map((frame) => frame.headWidth)
    );
    const leftMedianHeadWidth = median(
      opticalFrames.left.map((frame) => frame.headWidth)
    );
    const rightMedianHeadWidth = median(
      opticalFrames.right.map((frame) => frame.headWidth)
    );
    const profileMedianHeadWidth = (leftMedianHeadWidth + rightMedianHeadWidth) / 2;
    const headWidthsByDirection = Object.fromEntries(
      directions.map((direction) => [
        direction,
        directionMetrics[direction].map((frame) => frame.headWidth)
      ])
    );
    const maximumStepHeadWidthSpreadRatio = Math.max(...directions.map((direction) => {
      const widths = headWidthsByDirection[direction];
      return (Math.max(...widths) - Math.min(...widths)) / median(widths);
    }));
    const allHeadWidths = Object.values(headWidthsByDirection).flat();
    const maximumAllFrameHeadWidthSpreadRatio =
      (Math.max(...allHeadWidths) - Math.min(...allHeadWidths)) / median(allHeadWidths);
    const maximumStepFaceWidthSpreadRatio = Math.max(...["down", "left", "right"].map(
      (direction) => {
        const widths = opticalFrames[direction].map((frame) => frame.visibleFaceWidth);
        return (Math.max(...widths) - Math.min(...widths)) / median(widths);
      }
    ));
    const facialLandmarkCenterYRatios = Object.fromEntries(
      ["down", "left", "right"].map((direction) => [
        direction,
        median(opticalFrames[direction].map((frame) => frame.visibleFaceCenterYRatio))
      ])
    );
    const facialLandmarkBottomYRatios = Object.fromEntries(
      ["down", "left", "right"].map((direction) => [
        direction,
        median(opticalFrames[direction].map((frame) => frame.visibleFaceBottomYRatio))
      ])
    );
    const centerYValues = Object.values(facialLandmarkCenterYRatios);
    const bottomYValues = Object.values(facialLandmarkBottomYRatios);
    const directionMotion = {};
    for (const direction of directions) {
      const [firstStep, neutralStep, thirdStep, oppositeNeutralStep] = directionMetrics[direction];
      const averageStepWidth = (firstStep.characterWidth + thirdStep.characterWidth) / 2;
      const oppositeFootDifference = await lowerStrideDifference(
        frameBuffersByDirection[direction][0],
        frameBuffersByDirection[direction][2],
        policy
      );
      const sideDirection = direction === "left" || direction === "right";
      const neutralWidthLimit = Math.min(
        firstStep.neutralFootSpan,
        thirdStep.neutralFootSpan
      ) * 0.65;
      const guest03NeutralPoses = sideDirection
        ? neutralStep.neutralFootSpan <= neutralWidthLimit
          && oppositeNeutralStep.neutralFootSpan <= neutralWidthLimit
        : neutralStep.neutralFootSpan >= Math.max(
            firstStep.neutralFootSpan,
            thirdStep.neutralFootSpan
          )
          && oppositeNeutralStep.neutralFootSpan >= Math.max(
            firstStep.neutralFootSpan,
            thirdStep.neutralFootSpan
          );
      const neutralPairMirrored =
        neutralStep.mirroredNeutralFootBandSha256
          === oppositeNeutralStep.neutralFootBandSha256;
      const neutralPairDistinct =
        neutralStep.frameSha256 !== oppositeNeutralStep.frameSha256;
      const neutralPairExact =
        neutralStep.frameSha256 === oppositeNeutralStep.frameSha256;
      const guest01 = preset.reference.walkSourceGuest === "guest-01";
      const guest03 = preset.reference.walkSourceGuest === "guest-03";
      const neutralPairSameSilhouette =
        neutralStep.alphaSilhouetteSha256 === oppositeNeutralStep.alphaSilhouetteSha256;
      const neutralProtectedBandTop = guest01
        ? guest01UpperBodyBandBottom(policy) + 1
        : guest03
          ? guest03LegPhaseBandTop(policy)
          : neutralFootBandTop(policy);
      const neutralUpperBodyStable = await rgbaRowsSha256(
        frameBuffersByDirection[direction][1],
        neutralProtectedBandTop
      ) === await rgbaRowsSha256(
        frameBuffersByDirection[direction][3],
        neutralProtectedBandTop
      );
      const neutralLoadTransferDifference = await neutralFootDifference(
        frameBuffersByDirection[direction][1],
        frameBuffersByDirection[direction][3],
        policy
      );
      const sideFootGeometryStable = !sideDirection
        || firstStep.lowerStrideBandSha256 === thirdStep.lowerStrideBandSha256;
      const neutralPairPassed = neutralPairSameSilhouette
        && neutralUpperBodyStable
        && (guest01 || guest03 ? neutralPairDistinct : neutralPairExact)
        && (!guest03 || guest03NeutralPoses);
      const oppositeFootPassed = guest01
        ? oppositeFootDifference.rgba >= minimumGuest01OppositeFootRgbaDifference
          && (!sideDirection || (
            sideFootGeometryStable
            && oppositeFootDifference.alpha <= maximumGuest01SideOppositeFootAlphaDifference
          ))
        : guest03
          ? oppositeFootDifference.alpha >= minimumGuest03OppositeFootAlphaDifference
            && oppositeFootDifference.rgba >= minimumGuest03OppositeFootRgbaDifference
          : oppositeFootDifference.alpha >= (
            sideDirection
              ? minimumGenericSideOppositeFootAlphaDifference
              : minimumGenericFrontBackOppositeFootAlphaDifference
          ) && oppositeFootDifference.rgba >= (
            sideDirection
              ? minimumGenericSideOppositeFootRgbaDifference
              : minimumGenericFrontBackOppositeFootRgbaDifference
          );
      directionMotion[direction] = {
          firstStepWidth: firstStep.characterWidth,
          neutralStepWidth: neutralStep.characterWidth,
          thirdStepWidth: thirdStep.characterWidth,
          strideExpansionRatio: averageStepWidth / neutralStep.characterWidth,
          strideSilhouetteSymmetryRatio:
            Math.abs(firstStep.characterWidth - thirdStep.characterWidth) / averageStepWidth,
          maximumCenterDrift: Math.max(
            Math.abs(firstStep.characterCenterX - neutralStep.characterCenterX),
            Math.abs(thirdStep.characterCenterX - neutralStep.characterCenterX)
          ),
          baselineSpread: Math.max(
            firstStep.bottom,
            neutralStep.bottom,
            thirdStep.bottom,
            oppositeNeutralStep.bottom
          ) - Math.min(
            firstStep.bottom,
            neutralStep.bottom,
            thirdStep.bottom,
            oppositeNeutralStep.bottom
          ),
          neutralFootSpans: [
            firstStep.neutralFootSpan,
            neutralStep.neutralFootSpan,
            thirdStep.neutralFootSpan,
            oppositeNeutralStep.neutralFootSpan
          ],
          neutralPairMirrored,
          neutralPairSameSilhouette,
          neutralUpperBodyStable,
          neutralProtectedBandTop,
          neutralPairDistinct,
          neutralPairExact,
          neutralLoadTransferDifference,
          neutralPairPassed,
          sideFootGeometryStable,
          oppositeFootDifference,
          oppositeFootPassed
      };
    }
    const accessoryStability = preset.reference.walkSourceGuest === "guest-01"
      ? {
          upperBodyBandBottom: guest01UpperBodyBandBottom(policy),
          anchorSteps: guest01AccessoryAnchorStep,
          directions: Object.fromEntries(directions.map((direction) => {
            const hashes = directionMetrics[direction].map((frame) => frame.upperBodyBandSha256);
            return [direction, {
              hashes,
              stable: new Set(hashes).size === 1
            }];
          }))
        }
      : null;
    const proportionStability = preset.reference.walkSourceGuest === "guest-03"
      ? {
          bandBottom: guest03ProportionBandBottom(policy),
          directions: Object.fromEntries(directions.map((direction) => {
            const hashes = directionMetrics[direction].map((frame) => frame.headBandSha256);
            return [direction, {
              hashes,
              stable: new Set(hashes).size === 1
            }];
          }))
        }
      : null;
    if (accessoryStability) {
      accessoryStability.passed = Object.values(accessoryStability.directions)
        .every((direction) => direction.stable);
    }
    if (proportionStability) {
      proportionStability.passed = Object.values(proportionStability.directions)
        .every((direction) => direction.stable);
    }
    presets.push({
      id: preset.id,
      guest: preset.reference.walkSourceGuest,
      sourceSet: presetRig.sourceSet,
      upSourceHeadHeightConsensus: presetRig.upSourceHeadHeightConsensus,
      opticalFace: {
        downMedianFaceWidth,
        leftMedianFaceWidth,
        rightMedianFaceWidth,
        profileMedianFaceWidth,
        frontToProfileFaceWidthRatio: downMedianFaceWidth / profileMedianFaceWidth,
        downMedianFaceArea,
        leftMedianFaceArea,
        rightMedianFaceArea,
        profileMedianFaceArea,
        frontToProfileFaceAreaRatio: downMedianFaceArea / profileMedianFaceArea,
        maximumStepFaceWidthSpreadRatio,
        leftRightFaceWidthDifferenceRatio:
          Math.abs(leftMedianFaceWidth - rightMedianFaceWidth) / profileMedianFaceWidth
      },
      opticalHead: {
        downMedianHeadWidth,
        leftMedianHeadWidth,
        rightMedianHeadWidth,
        profileMedianHeadWidth,
        frontToProfileHeadWidthRatio: downMedianHeadWidth / profileMedianHeadWidth,
        leftRightHeadWidthDifferenceRatio:
          Math.abs(leftMedianHeadWidth - rightMedianHeadWidth) / profileMedianHeadWidth,
        ...(preset.reference.walkSourceGuest === "guest-03"
          ? {
              headWidthsByDirection,
              maximumStepHeadWidthSpreadRatio,
              maximumAllFrameHeadWidthSpreadRatio
            }
          : {})
      },
      opticalLandmarks: {
        centerYRatios: facialLandmarkCenterYRatios,
        bottomYRatios: facialLandmarkBottomYRatios,
        centerYSpreadRatio: Math.max(...centerYValues) - Math.min(...centerYValues),
        bottomYSpreadRatio: Math.max(...bottomYValues) - Math.min(...bottomYValues)
      },
      motion: {
        directions: directionMotion,
        maximumStrideSilhouetteSymmetryRatio: Math.max(
          ...Object.values(directionMotion).map((direction) =>
            direction.strideSilhouetteSymmetryRatio
          )
        ),
        leftRightStrideExpansionDifferenceRatio: Math.abs(
          directionMotion.left.strideExpansionRatio - directionMotion.right.strideExpansionRatio
        ),
        maximumCenterDrift: Math.max(
          ...Object.values(directionMotion).map((direction) => direction.maximumCenterDrift)
        ),
        maximumStepBaselineSpread: Math.max(
          ...Object.values(directionMotion).map((direction) => direction.baselineSpread)
        ),
        fourStepGaitPassed: Object.values(directionMotion)
          .every((direction) => direction.neutralPairPassed && direction.oppositeFootPassed)
      },
      directionConsistency,
      accessoryStability,
      ...(proportionStability ? { proportionStability } : {}),
      directions: directionMetrics
    });
  }
  const frames = presets.flatMap((preset) =>
    Object.entries(preset.directions).flatMap(([direction, directionFrames]) =>
      directionFrames.map((frame, step) => ({
        ...frame,
        presetId: preset.id,
        direction,
        step: step + 1
      }))
    )
  );
  const rigFailures = frames.filter((frame) => {
    const commonFailure = Math.abs(frame.characterHeight - policy.contentHeight) > 1
      || Math.abs(frame.bottom - policy.footBaseline) > 1
      || !frame.rigHashMatches;
    if (frame.sourceDetectionMethod === safeUnifiedDetectionMethod) {
      return commonFailure
        || frame.measuredBodyToHeadRatio < minimumSafeBodyToHeadRatio
        || frame.measuredBodyToHeadRatio > maximumSafeBodyToHeadRatio;
    }
    return commonFailure
      || Math.abs(frame.headHeightDelta) > 1
      || Math.abs(frame.measuredBodyHeight - (policy.contentHeight - policy.headHeight)) > 1
      || Math.abs(frame.headWidthDelta) > maximumHeadWidthDelta;
  });
  const opticalFaceFailures = presets.filter((preset) => {
    if (usesFaceSafeRig(preset.sourceSet)) {
      const maximumWidthRatio = maximumSafeFrontToProfileFaceWidthRatioByGuest[preset.guest]
        ?? maximumSafeFrontToProfileFaceWidthRatio;
      const maximumAreaRatio = maximumSafeFrontToProfileFaceAreaRatioByGuest[preset.guest]
        ?? maximumSafeFrontToProfileFaceAreaRatio;
      return preset.opticalFace.frontToProfileFaceWidthRatio
          < minimumSafeFrontToProfileFaceWidthRatio
        || preset.opticalFace.frontToProfileFaceWidthRatio > maximumWidthRatio
        || preset.opticalFace.frontToProfileFaceAreaRatio > maximumAreaRatio
        || preset.opticalFace.maximumStepFaceWidthSpreadRatio
          > maximumSafeStepFaceWidthSpreadRatio
        || preset.opticalFace.leftRightFaceWidthDifferenceRatio
          > maximumSafeLeftRightFaceWidthDifferenceRatio;
    }
    const usesMaster = preset.sourceSet === "v8-couple-depth-master";
    const maximumWidthRatio = usesMaster
      ? maximumMasterFrontToProfileFaceWidthRatio
      : maximumFrontToProfileFaceWidthRatio;
    const maximumAreaRatio = maximumFrontToProfileFaceAreaRatioByGuest[preset.guest]
      ?? (usesMaster
        ? maximumMasterFrontToProfileFaceAreaRatio
        : maximumFrontToProfileFaceAreaRatio);
    const maximumProfileDifference = usesMaster
      ? maximumMasterLeftRightFaceWidthDifferenceRatio
      : maximumLeftRightFaceWidthDifferenceRatio;
    return preset.opticalFace.frontToProfileFaceWidthRatio > maximumWidthRatio
      || preset.opticalFace.frontToProfileFaceWidthRatio < minimumFrontToProfileFaceWidthRatio
      || preset.opticalFace.frontToProfileFaceAreaRatio > maximumAreaRatio
      || preset.opticalFace.leftRightFaceWidthDifferenceRatio > maximumProfileDifference;
  });
  const opticalHeadFailures = presets.filter((preset) => {
    if (usesFaceSafeRig(preset.sourceSet)) {
      return preset.opticalHead.frontToProfileHeadWidthRatio
          < minimumSafeFrontToProfileHeadWidthRatio
        || preset.opticalHead.frontToProfileHeadWidthRatio
          > maximumSafeFrontToProfileHeadWidthRatio
        || preset.opticalHead.leftRightHeadWidthDifferenceRatio
          > maximumSafeLeftRightHeadWidthDifferenceRatio
        || (preset.guest === "guest-03" && (
          preset.opticalHead.maximumStepHeadWidthSpreadRatio
              > guest03MaximumHeadWidthDelta * 2 / policy.headWidth
          || Object.values(preset.directions).flat().some((frame) =>
            Math.abs(frame.headWidthDelta) > guest03MaximumHeadWidthDelta
          )
        ));
    }
    return preset.opticalHead.frontToProfileHeadWidthRatio < minimumFrontToProfileHeadWidthRatio
      || preset.opticalHead.frontToProfileHeadWidthRatio > maximumFrontToProfileHeadWidthRatio
      || Math.max(
        ...Object.values(preset.directions).flat().map((frame) => frame.headWidth)
      ) - Math.min(
        ...Object.values(preset.directions).flat().map((frame) => frame.headWidth)
      ) > maximumHeadWidthDelta;
  });
  const opticalLandmarkFailures = presets.filter((preset) => (
    preset.sourceSet !== "v8-couple-depth-master"
    && (
      preset.opticalLandmarks.centerYSpreadRatio > (
        usesFaceSafeRig(preset.sourceSet)
          ? 0.18
          : maximumFacialLandmarkVerticalSpreadRatio
      )
      || preset.opticalLandmarks.bottomYSpreadRatio > (
        usesFaceSafeRig(preset.sourceSet)
          ? 0.18
          : maximumFacialLandmarkVerticalSpreadRatio
      )
    )
  ));
  const motionFailures = presets.filter((preset) => (
    (preset.sourceSet !== "v8-couple-depth-master"
      && (
        preset.motion.maximumStrideSilhouetteSymmetryRatio
          > maximumStrideSilhouetteSymmetryRatio
        || preset.motion.leftRightStrideExpansionDifferenceRatio
          > maximumLeftRightStrideExpansionDifferenceRatio
      ))
    || preset.motion.maximumCenterDrift > maximumStrideCenterDrift
    || preset.motion.maximumStepBaselineSpread > maximumStepBaselineSpread
    || !preset.motion.fourStepGaitPassed
  ));
  const accessoryFailures = presets.filter((preset) => (
    preset.guest === "guest-01" && !preset.accessoryStability?.passed
  ));
  const proportionFailures = presets.filter((preset) => (
    preset.guest === "guest-03" && !preset.proportionStability?.passed
  ));
  const directionConsistencyFailures = presets.filter((preset) => (
    preset.directionConsistency.required && !preset.directionConsistency.passed
  ));
  const headWidths = frames.map((frame) => frame.headWidth);
  const headHeights = frames.map((frame) => frame.measuredHeadHeight);
  const directionHeadHeightSpreads = presets.map((preset) => {
    const values = Object.values(preset.directions)
      .flat()
      .map((frame) => frame.measuredHeadHeight);
    return Math.max(...values) - Math.min(...values);
  });
  const landmarkFrameCount = frames.filter(
    (frame) => frame.sourceDetectionMethod === "face-landmark"
  ).length;
  const consensusFrameCount = frames.filter(
    (frame) => frame.sourceDetectionMethod === "cross-direction-consensus"
  ).length;
  const faceSafeRigFrameCount = frames.filter(
    (frame) => frame.sourceDetectionMethod === safeUnifiedDetectionMethod
  ).length;
  const report = {
    version: 14,
    policy: {
      source: policy.source,
      contentHeight: policy.contentHeight,
      headHeight: policy.headHeight,
      bodyHeight: policy.contentHeight - policy.headHeight,
      headWidth: policy.headWidth,
      footBaseline: policy.footBaseline,
      maximumHeadWidthDelta,
      minimumFrontToProfileHeadWidthRatio,
      maximumFrontToProfileHeadWidthRatio,
      maximumHeadHeightDelta: 1,
      maximumDirectionHeadHeightSpread: 2,
      minimumFrontToProfileFaceWidthRatio,
      maximumFrontToProfileFaceWidthRatio,
      maximumFrontToProfileFaceAreaRatio,
      maximumFrontToProfileFaceAreaRatioByGuest,
      maximumMasterFrontToProfileFaceWidthRatio,
      maximumMasterFrontToProfileFaceAreaRatio,
      maximumMasterLeftRightFaceWidthDifferenceRatio,
      maximumLeftRightFaceWidthDifferenceRatio,
      maximumFacialLandmarkVerticalSpreadRatio,
      maximumStrideSilhouetteSymmetryRatio,
      maximumLeftRightStrideExpansionDifferenceRatio,
      maximumStrideCenterDrift,
      maximumStepBaselineSpread,
      maximumGuest01SideOppositeFootAlphaDifference,
      minimumGuest01OppositeFootRgbaDifference,
      minimumGuest03OppositeFootAlphaDifference,
      minimumGuest03OppositeFootRgbaDifference,
      minimumGenericSideOppositeFootAlphaDifference,
      minimumGenericSideOppositeFootRgbaDifference,
      minimumGenericFrontBackOppositeFootAlphaDifference,
      minimumGenericFrontBackOppositeFootRgbaDifference,
      maximumCanonicalDirectionDifference,
      minimumSafeBodyToHeadRatio,
      maximumSafeBodyToHeadRatio,
      maximumSafeStepFaceWidthSpreadRatio,
      minimumSafeFrontToProfileFaceWidthRatio,
      maximumSafeFrontToProfileFaceWidthRatio,
      maximumSafeFrontToProfileFaceWidthRatioByGuest,
      maximumSafeFrontToProfileFaceAreaRatio,
      maximumSafeFrontToProfileFaceAreaRatioByGuest,
      minimumSafeFrontToProfileHeadWidthRatio,
      maximumSafeFrontToProfileHeadWidthRatio,
      maximumSafeLeftRightHeadWidthDifferenceRatio,
      maximumSafeLeftRightFaceWidthDifferenceRatio,
      faceLandmarkRule: "alpha top to detected chin skin boundary",
      opticalFaceRule: "median visible skin width and area by down, left, and right direction",
      opticalHeadRule: "fixed head silhouette width and front/profile median ratio",
      opticalLandmarkRule: "median visible face center and chin anchors by visible direction",
      motionRule: "symmetric first and third steps, matched side stride, stable center and baseline",
      fourStepGaitRule:
        "frames 1 and 3 visibly alternate feet; generic frames 2 and 4 repeat one intact neutral pose without cutting the outfit",
      directionConsistencyRule:
        "guest 02 through 12 right-facing frames are exact final-pixel mirrors of left-facing frames",
      neutralIntegrityRule:
        "generic neutral frame 4 exactly repeats frame 2; guest 01 and 03 preserve the complete silhouette and protected upper outfit",
      guest01OpticalHeadCompensation,
      guest03OpticalHeadCompensation,
      guest03MaximumHeadWidthDelta,
      guest03HeadWidthsByDirection,
      guest01LowerBodyStrideOffsets,
      guest01StableSideFootReferenceStep,
      guest01AccessoryRule:
        "the complete upper body and handbag band is pixel-locked within each direction",
      guest01FootGeometryRule:
        "profile landing frames share one natural shoe silhouette and alternate leg depth without bending or mirroring the shoes",
      guest03ProportionRule:
        "the complete head, chin, and shoulder band is pixel-locked across all four walk frames within each direction",
      guest03SuitIntegrityRule:
        "leg phase emphasis starts below the intact jacket and alternates trouser shading without mirroring shoes"
    },
    summary: {
      presetCount: presets.length,
      frameCount,
      minimumMeasuredHeadHeight: Math.min(...headHeights),
      maximumMeasuredHeadHeight: Math.max(...headHeights),
      maximumHeadHeightDelta: Math.max(...headHeights.map((height) => Math.abs(height - policy.headHeight))),
      maximumDirectionHeadHeightSpread: Math.max(...directionHeadHeightSpreads),
      minimumHeadWidth: Math.min(...headWidths),
      maximumHeadWidth: Math.max(...headWidths),
      maximumHeadWidthDelta: Math.max(...headWidths.map((width) => Math.abs(width - policy.headWidth))),
      rigBodyToHeadRatio: (policy.contentHeight - policy.headHeight) / policy.headHeight,
      measuredHeadHeightWithinTolerance: frames.every((frame) => (
        frame.sourceDetectionMethod === safeUnifiedDetectionMethod
          ? frame.measuredBodyToHeadRatio >= minimumSafeBodyToHeadRatio
            && frame.measuredBodyToHeadRatio <= maximumSafeBodyToHeadRatio
          : Math.abs(frame.headHeightDelta) <= 1
      )),
      landmarkFrameCount,
      consensusFrameCount,
      faceSafeRigFrameCount,
      rigHashesMatch: frames.every((frame) => frame.rigHashMatches),
      maximumMeasuredFrontToProfileFaceWidthRatio: Math.max(
        ...presets.map((preset) => preset.opticalFace.frontToProfileFaceWidthRatio)
      ),
      minimumMeasuredFrontToProfileFaceWidthRatio: Math.min(
        ...presets.map((preset) => preset.opticalFace.frontToProfileFaceWidthRatio)
      ),
      maximumMeasuredFrontToProfileFaceAreaRatio: Math.max(
        ...presets.map((preset) => preset.opticalFace.frontToProfileFaceAreaRatio)
      ),
      maximumMeasuredLeftRightFaceWidthDifferenceRatio: Math.max(
        ...presets.map((preset) => preset.opticalFace.leftRightFaceWidthDifferenceRatio)
      ),
      opticalFaceWidthWithinTolerance: opticalFaceFailures.length === 0,
      maximumMeasuredFrontToProfileHeadWidthRatio: Math.max(
        ...presets.map((preset) => preset.opticalHead.frontToProfileHeadWidthRatio)
      ),
      minimumMeasuredFrontToProfileHeadWidthRatio: Math.min(
        ...presets.map((preset) => preset.opticalHead.frontToProfileHeadWidthRatio)
      ),
      opticalHeadWidthWithinTolerance: opticalHeadFailures.length === 0,
      maximumMeasuredFacialLandmarkCenterYSpreadRatio: Math.max(
        ...presets.map((preset) => preset.opticalLandmarks.centerYSpreadRatio)
      ),
      maximumMeasuredFacialLandmarkBottomYSpreadRatio: Math.max(
        ...presets.map((preset) => preset.opticalLandmarks.bottomYSpreadRatio)
      ),
      opticalLandmarksWithinTolerance: opticalLandmarkFailures.length === 0,
      maximumMeasuredStrideSilhouetteSymmetryRatio: Math.max(
        ...presets.map((preset) => preset.motion.maximumStrideSilhouetteSymmetryRatio)
      ),
      maximumMeasuredLeftRightStrideExpansionDifferenceRatio: Math.max(
        ...presets.map((preset) => preset.motion.leftRightStrideExpansionDifferenceRatio)
      ),
      maximumMeasuredStrideCenterDrift: Math.max(
        ...presets.map((preset) => preset.motion.maximumCenterDrift)
      ),
      maximumMeasuredStepBaselineSpread: Math.max(
        ...presets.map((preset) => preset.motion.maximumStepBaselineSpread)
      ),
      motionWithinTolerance: motionFailures.length === 0,
      fourStepGaitPassed: presets.every((preset) => preset.motion.fourStepGaitPassed),
      directionConsistencyPassed: directionConsistencyFailures.length === 0,
      maximumCanonicalDirectionAlphaDifference: Math.max(
        ...presets.filter((preset) => preset.directionConsistency.required)
          .map((preset) => preset.directionConsistency.maximumAlphaDifference)
      ),
      maximumCanonicalDirectionRgbaDifference: Math.max(
        ...presets.filter((preset) => preset.directionConsistency.required)
          .map((preset) => preset.directionConsistency.maximumRgbaDifference)
      ),
      guest01AccessoryStable: accessoryFailures.length === 0,
      passed: rigFailures.length === 0
        && opticalHeadFailures.length === 0
        && opticalFaceFailures.length === 0
        && opticalLandmarkFailures.length === 0
        && motionFailures.length === 0
        && accessoryFailures.length === 0
        && proportionFailures.length === 0
        && directionConsistencyFailures.length === 0
    },
    presets
  };
  if (!report.summary.passed) {
    const rigDetails = rigFailures
      .map((frame) =>
        `${frame.presetId}/${frame.direction}/step-${frame.step}: `
        + `height=${frame.characterHeight}, bottom=${frame.bottom}, `
        + `headHeight=${frame.measuredHeadHeight}, headWidth=${frame.headWidth}, `
        + `rigHash=${frame.rigHashMatches}`
      )
      .join("; ");
    const opticalFaceDetails = opticalFaceFailures
      .map((preset) =>
        `${preset.guest}: front/profile=${preset.opticalFace.frontToProfileFaceWidthRatio.toFixed(3)}, `
        + `area=${preset.opticalFace.frontToProfileFaceAreaRatio.toFixed(3)}, `
        + `left/right=${preset.opticalFace.leftRightFaceWidthDifferenceRatio.toFixed(3)}`
      )
      .join("; ");
    const opticalHeadDetails = opticalHeadFailures
      .map((preset) =>
        `${preset.guest}: front/profile-head=${preset.opticalHead.frontToProfileHeadWidthRatio.toFixed(3)}, `
        + `left/right-head=${preset.opticalHead.leftRightHeadWidthDifferenceRatio.toFixed(3)}`
      )
      .join("; ");
    const opticalLandmarkDetails = opticalLandmarkFailures
      .map((preset) =>
        `${preset.guest}: center=${preset.opticalLandmarks.centerYSpreadRatio.toFixed(3)}, `
        + `chin=${preset.opticalLandmarks.bottomYSpreadRatio.toFixed(3)}`
      )
      .join("; ");
    const motionDetails = motionFailures
      .map((preset) =>
        `${preset.guest}: symmetry=${preset.motion.maximumStrideSilhouetteSymmetryRatio.toFixed(3)}, `
        + `sideStride=${preset.motion.leftRightStrideExpansionDifferenceRatio.toFixed(3)}, `
        + `center=${preset.motion.maximumCenterDrift.toFixed(1)}, `
        + `baseline=${preset.motion.maximumStepBaselineSpread}`
      )
      .join("; ");
    const directionConsistencyDetails = directionConsistencyFailures
      .map((preset) =>
        `${preset.guest}: alpha=${preset.directionConsistency.maximumAlphaDifference.toFixed(6)}, `
        + `rgba=${preset.directionConsistency.maximumRgbaDifference.toFixed(6)}`
      )
      .join("; ");
    throw new Error(
      `선택 화면 3등신·얼굴·보행 감사 실패: ${rigFailures.length}개 프레임, `
      + `${opticalHeadFailures.length}명 머리 실루엣, `
      + `${opticalFaceFailures.length}명 얼굴 폭, `
      + `${opticalLandmarkFailures.length}명 얼굴 기준선, `
      + `${motionFailures.length}명 보행, `
      + `${accessoryFailures.length}명 가방 고정, `
      + `${proportionFailures.length}명 머리 고정, `
      + `${directionConsistencyFailures.length}명 좌우 방향 (${rigDetails || "리그 통과"}; `
      + `${opticalHeadDetails || "머리 실루엣 통과"}; `
      + `${opticalFaceDetails || "얼굴 폭 통과"}; `
      + `${opticalLandmarkDetails || "얼굴 기준선 통과"}; `
      + `${motionDetails || "보행 통과"}; `
      + `${directionConsistencyDetails || "좌우 방향 통과"}; `
      + `${accessoryFailures.length === 0 ? "가방 고정 통과" : "guest-01 가방 고정 실패"})`
    );
  }
  return report;
}

async function renderReview({ catalog, outputRoot, reviewPath }) {
  const policy = catalog.frame.selectionPreview;
  const cardWidth = 420;
  const cardHeight = 442;
  const columns = 3;
  const gap = 12;
  const padding = 16;
  const frameWidth = 64;
  const frameHeight = 96;
  const frameScale = frameWidth / policy.source.width;
  const composites = [];
  for (let index = 0; index < catalog.presets.length; index += 1) {
    const preset = catalog.presets[index];
    const cardX = padding + (index % columns) * (cardWidth + gap);
    const cardY = padding + Math.floor(index / columns) * (cardHeight + gap);
    const walkPath = framePath(outputRoot, preset.id, "walk");
    const label = Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${cardWidth}" height="${cardHeight}" rx="14" fill="#fffdf8" stroke="#d8cbc2"/>
      <text x="14" y="21" font-family="sans-serif" font-size="12" font-weight="700" fill="#594f4b">${preset.reference.walkSourceGuest} · ${preset.id}</text>
    </svg>`);
    composites.push({ input: label, left: cardX, top: cardY });
    for (let row = 0; row < directions.length; row += 1) {
      const rowY = cardY + 32 + row * 101;
      const directionLabel = Buffer.from(`<svg width="58" height="96" xmlns="http://www.w3.org/2000/svg">
        <text x="4" y="18" font-family="sans-serif" font-size="11" font-weight="700" fill="#655a56">${directions[row]}</text>
        <text x="4" y="36" font-family="sans-serif" font-size="8" fill="#8b7d76">1 · 2 · 3 · 4</text>
      </svg>`);
      composites.push({ input: directionLabel, left: cardX + 10, top: rowY });
      for (let column = 0; column < catalog.frame.walk.columns; column += 1) {
        const frame = await sharp(walkPath)
          .extract({
            left: column * policy.source.width,
            top: row * policy.source.height,
            width: policy.source.width,
            height: policy.source.height
          })
          .resize(frameWidth, frameHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
          .png()
          .toBuffer();
        const frameX = cardX + 70 + column * (frameWidth + 18);
        composites.push({ input: frame, left: frameX, top: rowY });
        const top = (policy.footBaseline - policy.contentHeight + 1) * frameScale;
        const head = top + policy.headHeight * frameScale;
        const body = head + policy.headHeight * frameScale;
        const foot = policy.footBaseline * frameScale;
        const guides = Buffer.from(`<svg width="${frameWidth}" height="${frameHeight}" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 ${top}H${frameWidth}" stroke="#3b82f6" stroke-width="0.8"/>
          <path d="M0 ${head}H${frameWidth}" stroke="#ef4444" stroke-width="1"/>
          <path d="M0 ${body}H${frameWidth}" stroke="#f59e0b" stroke-width="0.8"/>
          <path d="M0 ${foot}H${frameWidth}" stroke="#22c55e" stroke-width="0.8"/>
        </svg>`);
        composites.push({ input: guides, left: frameX, top: rowY });
      }
    }
  }
  const rows = Math.ceil(catalog.presets.length / columns);
  await mkdir(path.dirname(reviewPath), { recursive: true });
  await sharp({
    create: {
      width: padding * 2 + columns * cardWidth + (columns - 1) * gap,
      height: padding * 2 + rows * cardHeight + (rows - 1) * gap,
      channels: 4,
      background: "#eee8e2"
    }
  }).composite(composites).png().toFile(reviewPath);
}

export async function auditGuestSelectionPreviewAssets({
  catalog: providedCatalog,
  outputRoot = defaultOutputRoot,
  runtimeOutputRoot = defaultRuntimeOutputRoot
} = {}) {
  const catalog = providedCatalog ?? JSON.parse(await readFile(catalogPath, "utf8"));
  const storedReport = JSON.parse(
    await readFile(path.join(outputRoot, "selection-preview-audit.json"), "utf8")
  );
  if (storedReport.version !== 14) {
    throw new Error("방향별 얼굴 폭·면적·실게임 보행 중심 기반 3등신 감사 보고서를 다시 생성해야 합니다.");
  }
  const sourceRig = Object.fromEntries(storedReport.presets.map((preset) => [
    preset.id,
    {
      sourceSet: preset.sourceSet,
      upSourceHeadHeightConsensus: preset.upSourceHeadHeightConsensus,
      directions: Object.fromEntries(Object.entries(preset.directions).map(([direction, frames]) => [
        direction,
        frames.map((frame) => ({
          sourceHeadHeight: frame.sourceHeadHeight,
          sourceMeasuredHeadHeight: frame.sourceMeasuredHeadHeight,
          sourceDetectionMethod: frame.sourceDetectionMethod,
          sourceFaceBottom: frame.sourceFaceBottom,
          frameSha256: frame.frameSha256
        }))
      ]))
    }
  ]));
  const report = await inspectPreviewSheets({ catalog, outputRoot, sourceRig });
  const runtimeMotion = await inspectRuntimeMotion({ catalog, runtimeOutputRoot });
  report.runtimeMotion = runtimeMotion;
  report.summary.maximumRuntimeCoreCenterDriftDisplayPx =
    runtimeMotion.summary.maximumMeasuredCoreCenterDriftDisplayPx;
  report.summary.runtimeMotionWithinTolerance = runtimeMotion.summary.passed;
  report.summary.passed = report.summary.passed && runtimeMotion.summary.passed;
  return report;
}

export async function buildGuestSelectionPreviewAssets({
  catalog: providedCatalog,
  outputRoot = defaultOutputRoot,
  runtimeOutputRoot = defaultRuntimeOutputRoot,
  walkSourceRoot = defaultWalkSourceRoot,
  walkSourceOverrideRoot = defaultWalkSourceOverrideRoot,
  walkSourceFaceOverrideRoot = defaultWalkSourceFaceOverrideRoot,
  walkSourcePolishOverrideRoot = defaultWalkSourcePolishOverrideRoot,
  walkSourceFrontFaceOverrideRoot = defaultWalkSourceFrontFaceOverrideRoot,
  walkSourceOpticalOverrideRoot = defaultWalkSourceOpticalOverrideRoot,
  walkSourceDepthOverrideRoot = defaultWalkSourceDepthOverrideRoot,
  coupleDepthMasterSourceRoot = defaultCoupleDepthMasterSourceRoot,
  unifiedRigSourceRoot = defaultUnifiedRigSourceRoot,
  frameReviewRoot = defaultFrameReviewRoot,
  reviewPath = defaultReviewPath
} = {}) {
  const catalog = providedCatalog ?? JSON.parse(await readFile(catalogPath, "utf8"));
  const policy = catalog.frame.selectionPreview;
  const runtimePolicy = catalog.frame.source;
  await Promise.all([
    mkdir(outputRoot, { recursive: true }),
    mkdir(runtimeOutputRoot, { recursive: true }),
    mkdir(frameReviewRoot, { recursive: true })
  ]);
  const sourceRig = {};
  for (const preset of catalog.presets) {
    const guest = preset.reference.walkSourceGuest;
    const unifiedRigSource = path.join(unifiedRigSourceRoot, `${guest}-walk-sheet.png`);
    let sourceSet = safeUnifiedSourceSet;
    let sourceGrid = null;
    let coupleDepthMasterFrames = null;
    let sourceColumnCount = 3;
    let hasUnifiedRigSource = false;
    try {
      await access(unifiedRigSource);
      hasUnifiedRigSource = true;
    } catch {
      // Custom fixtures and incremental authoring may intentionally omit v10.
    }
    if (hasUnifiedRigSource) {
      sourceGrid = await loadWalkSheetGrid(unifiedRigSource);
    } else {
      coupleDepthMasterFrames = await loadCoupleDepthMasterFrames(
        guest,
        coupleDepthMasterSourceRoot
      );
      sourceSet = "v8-couple-depth-master";
    }
    if (!sourceGrid && !coupleDepthMasterFrames) {
      const resolved = await resolveWalkSource({
        guest,
        walkSourceRoot,
        walkSourceOverrideRoot,
        walkSourceFaceOverrideRoot,
        walkSourcePolishOverrideRoot,
        walkSourceFrontFaceOverrideRoot,
        walkSourceOpticalOverrideRoot,
        walkSourceDepthOverrideRoot
      });
      sourceSet = resolved.sourceSet;
      sourceGrid = await loadWalkSheetGrid(resolved.source);
    }
    const baseFramesByDirection = {};
    const detectedLandmarks = [];
    for (let row = 0; row < directions.length; row += 1) {
      const direction = directions[row];
      baseFramesByDirection[direction] = [];
      for (let column = 0; column < sourceColumnCount; column += 1) {
        const extracted = coupleDepthMasterFrames
          ? coupleDepthMasterFrames[direction][column]
          : await extractWalkCell(sourceGrid, row, column);
        const normalized = await normalizeSelectionPreviewBaseFrame(extracted, policy);
        let landmark = null;
        if (direction !== "up") {
          try {
            landmark = await detectFaceLandmark(normalized, policy, {
              knownHeadHeight: sourceSet === "v8-couple-depth-master"
                ? policy.headHeight
                : undefined
            });
          } catch (error) {
            throw new Error(
              `${guest}/${direction}/step-${column + 1} 얼굴 기준점 감지 실패: ${error.message}`,
              { cause: error }
            );
          }
        }
        baseFramesByDirection[direction].push({ normalized, landmark });
        if (landmark) detectedLandmarks.push(landmark.headHeight);
      }
    }
    const upSourceHeadHeightConsensus = Math.round(median(detectedLandmarks));
    sourceRig[preset.id] = {
      sourceSet,
      upSourceHeadHeightConsensus,
      directions: {}
    };
    const framesByDirection = {};
    for (let row = 0; row < directions.length; row += 1) {
      const direction = directions[row];
      framesByDirection[direction] = [];
      sourceRig[preset.id].directions[direction] = [];
      for (let column = 0; column < sourceColumnCount; column += 1) {
        const baseFrame = baseFramesByDirection[direction][column];
        const usesUnifiedRig = usesFaceSafeRig(sourceSet);
        const sourceMeasuredHeadHeight = usesUnifiedRig
          ? baseFrame.landmark?.headHeight ?? upSourceHeadHeightConsensus
          : baseFrame.landmark?.headHeight ?? upSourceHeadHeightConsensus;
        const opticalHeadCompensation = guest === "guest-01"
          ? guest01OpticalHeadCompensation
          : guest === "guest-03"
            ? guest03OpticalHeadCompensation
            : 0;
        let sourceHeadHeight = Math.max(
          2,
          sourceMeasuredHeadHeight - opticalHeadCompensation
        );
        const renderCandidate = async (candidateHeadHeight) => {
          const rigged = await normalizeVerticalRig(
            baseFrame.normalized,
            policy,
            candidateHeadHeight
          );
          const candidate = await normalizeHeadWidth(rigged, policy);
          const measuredHeadHeight = baseFrame.landmark
            ? (await detectFaceLandmark(candidate, policy, {
                knownHeadHeight: sourceSet === "v8-couple-depth-master"
                  ? policy.headHeight
                  : undefined
              })).headHeight
            : policy.headHeight;
          return { candidate, candidateHeadHeight, measuredHeadHeight };
        };
        const faceSafeCandidate = usesUnifiedRig
          ? await normalizeFaceSafeThreeHeadRig(
              baseFrame.normalized,
              policy,
              sourceHeadHeight
            )
          : null;
        let best = usesUnifiedRig
          ? {
              candidate: guest === "guest-03"
                ? await normalizeHeadWidth(
                    faceSafeCandidate,
                    policy,
                    guest03HeadWidthsByDirection[direction],
                    0,
                    6
                  )
                : faceSafeCandidate,
              candidateHeadHeight: sourceHeadHeight,
              measuredHeadHeight: policy.headHeight
            }
          : await renderCandidate(sourceHeadHeight);
        if (!usesUnifiedRig && baseFrame.landmark && best.measuredHeadHeight !== policy.headHeight) {
          for (let offset = -4; offset <= 4; offset += 1) {
            if (offset === 0) continue;
            const candidateHeadHeight = clamp(
              sourceMeasuredHeadHeight + offset,
              Math.round(policy.headHeight * 0.7),
              Math.round(policy.headHeight * 1.4)
            );
            const candidate = await renderCandidate(candidateHeadHeight);
            const candidateDelta = Math.abs(candidate.measuredHeadHeight - policy.headHeight);
            const bestDelta = Math.abs(best.measuredHeadHeight - policy.headHeight);
            if (candidateDelta < bestDelta) best = candidate;
            if (candidateDelta === 0) break;
          }
        }
        const normalized = best.candidate;
        sourceHeadHeight = best.candidateHeadHeight;
        framesByDirection[direction].push(normalized);
        sourceRig[preset.id].directions[direction].push({
          sourceHeadHeight,
          sourceMeasuredHeadHeight,
          sourceDetectionMethod: usesUnifiedRig
            ? safeUnifiedDetectionMethod
            : baseFrame.landmark
            ? "face-landmark"
            : "cross-direction-consensus",
          sourceFaceBottom: baseFrame.landmark?.faceBottom ?? null
        });
      }
    }
    if (sourceColumnCount === 3) {
      for (const direction of directions) {
        framesByDirection[direction].push(framesByDirection[direction][1]);
        sourceRig[preset.id].directions[direction].push({
          ...sourceRig[preset.id].directions[direction][1]
        });
      }
    }
    if (usesFaceSafeRig(sourceSet)) {
      // The v10 sheets already have genuine alpha and canonical mirrored profiles.
      // The face is scaled uniformly; only the body below the chin may stretch vertically.
    } else if (sourceSet === "v8-couple-depth-master") {
      await softenMasterFrontFaceWidth(framesByDirection, policy, guest);
    } else {
      await harmonizeProfileHeads(framesByDirection, policy);
      if (sourceSet === "v7-optical-face-balance") {
        await balanceOpticalFrontFaceWidth(framesByDirection, policy);
      } else {
        await balanceVisibleFaceWidths(framesByDirection, policy);
      }
    }
    if (guest === "guest-01") {
      await lockGuest01UpperBodyAndBag(framesByDirection, policy);
      await stabilizeGuest01FootGeometry(framesByDirection, policy);
    } else if (guest === "guest-03") {
      await lockGuest03HeadBand(framesByDirection, policy);
      await emphasizeGuest03LegPhases(framesByDirection, policy);
    } else {
      stabilizeNeutralPose(framesByDirection);
    }
    if (guest !== "guest-01") {
      await canonicalizeRightDirection(framesByDirection);
    }
    for (const direction of directions) {
      for (let column = 0; column < catalog.frame.walk.columns; column += 1) {
        await writePng(
          path.join(
            frameReviewRoot,
            guest,
            direction,
            `step-${String(column + 1).padStart(2, "0")}.png`
          ),
          framesByDirection[direction][column]
        );
      }
    }
    const previewWalkComposites = [];
    const runtimeFramesByDirection = {};
    for (let row = 0; row < directions.length; row += 1) {
      const direction = directions[row];
      runtimeFramesByDirection[direction] = [];
      for (let column = 0; column < catalog.frame.walk.columns; column += 1) {
        const previewFrame = framesByDirection[direction][column];
        const runtimeFrame = await normalizeRuntimeFrame(previewFrame, policy, runtimePolicy);
        previewWalkComposites.push({
          input: previewFrame,
          left: column * policy.source.width,
          top: row * policy.source.height
        });
        runtimeFramesByDirection[direction].push(runtimeFrame);
      }
      runtimeFramesByDirection[direction] = await stabilizeRuntimeWalkCycle(
        runtimeFramesByDirection[direction],
        {
          source: runtimePolicy,
          contentHeight: policy.contentHeight / 2,
          headHeight: policy.headHeight / 2,
          footBaseline: policy.footBaseline / 2
        },
        sourceSet === "v8-couple-depth-master"
          || usesFaceSafeRig(sourceSet)
          ? 12
          : 2
      );
      if (guest === "guest-03") {
        runtimeFramesByDirection[direction] = await lockProportionBandAcrossFrames(
          runtimeFramesByDirection[direction],
          {
            source: runtimePolicy,
            contentHeight: policy.contentHeight / 2,
            headHeight: policy.headHeight / 2,
            footBaseline: policy.footBaseline / 2
          }
        );
      }
    }
    const runtimeWalkComposites = directions.flatMap((direction, row) =>
      runtimeFramesByDirection[direction].map((runtimeFrame, column) => ({
        input: runtimeFrame,
        left: column * runtimePolicy.width,
        top: row * runtimePolicy.height
      }))
    );
    const previewWalk = await transparentCanvas(
      policy.walk.sheet.width,
      policy.walk.sheet.height,
      previewWalkComposites
    );
    const previewNeutral = framesByDirection.down[1];
    const previewIdle = await transparentCanvas(policy.idle.sheet.width, policy.idle.sheet.height, [
      { input: previewNeutral, left: 0, top: 0 },
      { input: previewNeutral, left: policy.source.width, top: 0 }
    ]);
    const runtimeWalk = await transparentCanvas(
      catalog.frame.walk.sheet.width,
      catalog.frame.walk.sheet.height,
      runtimeWalkComposites
    );
    const runtimeNeutral = await normalizeRuntimeFrame(previewNeutral, policy, runtimePolicy);
    const runtimeIdle = await transparentCanvas(
      catalog.frame.idle.sheet.width,
      catalog.frame.idle.sheet.height,
      [
        { input: runtimeNeutral, left: 0, top: 0 },
        { input: runtimeNeutral, left: runtimePolicy.width, top: 0 }
      ]
    );
    await Promise.all([
      writePng(framePath(outputRoot, preset.id, "walk"), previewWalk),
      writePng(framePath(outputRoot, preset.id, "idle"), previewIdle),
      writePng(framePath(runtimeOutputRoot, preset.id, "walk"), runtimeWalk),
      writePng(framePath(runtimeOutputRoot, preset.id, "idle"), runtimeIdle)
    ]);
  }
  const report = await inspectPreviewSheets({ catalog, outputRoot, sourceRig });
  const runtimeMotion = await inspectRuntimeMotion({ catalog, runtimeOutputRoot });
  report.runtimeMotion = runtimeMotion;
  report.summary.maximumRuntimeCoreCenterDriftDisplayPx =
    runtimeMotion.summary.maximumMeasuredCoreCenterDriftDisplayPx;
  report.summary.runtimeMotionWithinTolerance = runtimeMotion.summary.passed;
  report.summary.passed = report.summary.passed && runtimeMotion.summary.passed;
  if (!runtimeMotion.summary.passed) {
    if (!runtimeMotion.summary.guest03ProportionStable) {
      throw new Error("3번 캐릭터 실게임 보행 머리·턱·어깨 비율 고정이 풀렸습니다.");
    }
    throw new Error(
      `실게임 보행 상체 중심 흔들림 ${runtimeMotion.summary.maximumMeasuredCoreCenterDriftDisplayPx.toFixed(2)}px가 `
      + `${runtimeMotion.policy.maximumCoreCenterDriftDisplayPx.toFixed(2)}px를 넘었습니다.`
    );
  }
  await writeFile(
    path.join(outputRoot, "selection-preview-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await renderReview({ catalog, outputRoot, reviewPath });
  return {
    report,
    reviewPath,
    outputRoot,
    runtimeOutputRoot,
    walkSourceRoot,
    walkSourceOverrideRoot,
    walkSourceFaceOverrideRoot,
    walkSourcePolishOverrideRoot,
    walkSourceFrontFaceOverrideRoot,
    walkSourceOpticalOverrideRoot,
    walkSourceDepthOverrideRoot,
    coupleDepthMasterSourceRoot,
    unifiedRigSourceRoot
  };
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  if (checkOnly) {
    const report = await auditGuestSelectionPreviewAssets();
    console.log(
      `선택 화면 고해상도 3등신 감사 통과: ${report.summary.presetCount}명 · `
      + `${report.summary.frameCount}프레임 · 머리 폭 ${report.summary.minimumHeadWidth}-${report.summary.maximumHeadWidth}px`
    );
    return;
  }
  const result = await buildGuestSelectionPreviewAssets();
  console.log(
    `입체 명암 3등신 선택·게임 캐릭터 생성 완료: ${result.report.summary.presetCount}명 · `
      + `${result.report.summary.frameCount}프레임`
  );
  console.log(result.reviewPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
