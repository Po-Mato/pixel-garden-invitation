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
const defaultFrameReviewRoot = path.join(defaultWalkSourceRoot, "frames");
const defaultOutputRoot = path.join(root, "character-assets/source/guests-preview");
const defaultRuntimeOutputRoot = path.join(root, "character-assets/source/guests");
const defaultReviewPath = path.join(
  root,
  ".superpowers/character-review/guest-selection-preview-hd-ratio.png"
);
const directions = ["down", "left", "right", "up"];

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function isConnectedBackgroundPixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  return alpha === 0 || (minimum >= 224 && maximum - minimum <= 18);
}

function clearConnectedBackground(data, width, height) {
  const queued = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pixel = y * width + x;
    if (queued[pixel] || !isConnectedBackgroundPixel(data, pixel * 4)) return;
    queued[pixel] = 1;
    queue[tail] = pixel;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const pixel = queue[head];
    head += 1;
    data[pixel * 4 + 3] = 0;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }
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

async function loadWalkSheetGrid(input) {
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`${input} 보행 시트의 크기를 확인할 수 없습니다.`);
  }
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  clearConnectedBackground(data, info.width, info.height);
  const columns = detectGridBands(data, info.width, info.height, "x", 3);
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
  walkSourcePolishOverrideRoot
}) {
  const filename = `${guest}-walk-sheet.png`;
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

export async function detectFaceLandmark(input, policy) {
  const bounds = await alphaBounds(input);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(info.width * info.height);
  const scanBottom = Math.min(
    bounds.bottom,
    bounds.top + Math.round(policy.headHeight * 1.55)
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
      component.area >= 80
      && component.bottom >= bounds.top + Math.round(policy.headHeight * 0.5)
      && component.bottom <= bounds.top + Math.round(policy.headHeight * 1.3)
      && component.top <= bounds.top + policy.headHeight
      && component.right - component.left + 1 >= 8
    ))
    .sort((first, second) => second.area - first.area);
  const primary = candidates[0];
  if (!primary) throw new Error("실제 얼굴 피부 영역과 턱선을 찾지 못했습니다.");
  const faceCluster = candidates.filter((component) => (
    component === primary
    || (
      verticalOverlap(primary, component) >= 6
      && horizontalGap(primary, component) <= 5
    )
  ));
  const faceLeft = Math.min(...faceCluster.map((component) => component.left));
  const faceTop = Math.min(...faceCluster.map((component) => component.top));
  const faceRight = Math.max(...faceCluster.map((component) => component.right));
  const faceBottom = Math.max(...faceCluster.map((component) => component.bottom));
  const headHeight = faceBottom - bounds.top + 1;
  if (headHeight < Math.round(policy.headHeight * 0.7)
    || headHeight > Math.round(policy.headHeight * 1.4)) {
    throw new Error(`실제 머리 높이 ${headHeight}px가 안전한 교정 범위를 벗어났습니다.`);
  }
  return {
    characterTop: bounds.top,
    faceLeft,
    faceTop,
    faceRight,
    faceBottom,
    faceWidth: faceRight - faceLeft + 1,
    faceHeight: faceBottom - faceTop + 1,
    headHeight,
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

async function normalizeHeadWidth(input, policy) {
  let current = input;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const measured = await headBandWidth(current, policy);
    if (Math.abs(measured - policy.headWidth) <= 1) break;
    const scale = clamp(policy.headWidth / measured, 0.8, 1.25);
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
  const widthNormalized = await normalizeHeadWidth(normalized, runtimePolicy);
  const { data: normalizedData, info: normalizedInfo } = await sharp(widthNormalized)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const solidAlpha = Buffer.alloc(runtimeSource.width * runtimeSource.height);
  const edgeData = Buffer.from(normalizedData);
  for (let pixel = 0; pixel < solidAlpha.length; pixel += 1) {
    const offset = pixel * 4;
    const alpha = edgeData[offset + 3] >= 20 ? 255 : 0;
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

async function inspectFrame(input, policy, { direction, rigFrame }) {
  const bounds = await alphaBounds(input);
  const measuredHeadWidth = await headBandWidth(input, policy);
  const landmark = direction === "up"
    ? null
    : await detectFaceLandmark(input, policy);
  const measuredHeadHeight = landmark?.headHeight ?? policy.headHeight;
  const measuredBodyHeight = bounds.height - measuredHeadHeight;
  const checksum = frameSha256(input);
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
    headWidthDelta: measuredHeadWidth - policy.headWidth,
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
    sourceDetectionMethod: rigFrame.sourceDetectionMethod,
    sourceFaceBottom: rigFrame.sourceFaceBottom,
    frameSha256: checksum,
    rigHashMatches: !rigFrame.frameSha256 || rigFrame.frameSha256 === checksum
  };
}

function framePath(rootPath, presetId, kind) {
  return path.join(rootPath, `${presetId}__${kind}.png`);
}

async function inspectPreviewSheets({ catalog, outputRoot, sourceRig }) {
  const policy = catalog.frame.selectionPreview;
  const maximumFrontToProfileFaceWidthRatio = 1.35;
  const maximumLeftRightFaceWidthDifferenceRatio = 0.2;
  const maximumFacialLandmarkVerticalSpreadRatio = 0.15;
  const maximumStrideSilhouetteSymmetryRatio = 0.08;
  const maximumLeftRightStrideExpansionDifferenceRatio = 0.08;
  const maximumStrideCenterDrift = 4;
  const maximumStepBaselineSpread = 1;
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
    const presetRig = sourceRig[preset.id];
    if (!presetRig) throw new Error(`${preset.id} 방향별 3등신 리그 정보가 없습니다.`);
    for (let row = 0; row < directions.length; row += 1) {
      const direction = directions[row];
      directionMetrics[direction] = [];
      for (let column = 0; column < 3; column += 1) {
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
        directionMetrics[direction].push(await inspectFrame(frame, policy, { direction, rigFrame }));
        frameCount += 1;
      }
    }
    const downMedianFaceWidth = median(
      directionMetrics.down.map((frame) => frame.visibleFaceWidth)
    );
    const leftMedianFaceWidth = median(
      directionMetrics.left.map((frame) => frame.visibleFaceWidth)
    );
    const rightMedianFaceWidth = median(
      directionMetrics.right.map((frame) => frame.visibleFaceWidth)
    );
    const profileMedianFaceWidth = (leftMedianFaceWidth + rightMedianFaceWidth) / 2;
    const facialLandmarkCenterYRatios = Object.fromEntries(
      ["down", "left", "right"].map((direction) => [
        direction,
        median(directionMetrics[direction].map((frame) => frame.visibleFaceCenterYRatio))
      ])
    );
    const facialLandmarkBottomYRatios = Object.fromEntries(
      ["down", "left", "right"].map((direction) => [
        direction,
        median(directionMetrics[direction].map((frame) => frame.visibleFaceBottomYRatio))
      ])
    );
    const centerYValues = Object.values(facialLandmarkCenterYRatios);
    const bottomYValues = Object.values(facialLandmarkBottomYRatios);
    const directionMotion = Object.fromEntries(
      directions.map((direction) => {
        const [firstStep, neutralStep, thirdStep] = directionMetrics[direction];
        const averageStepWidth = (firstStep.characterWidth + thirdStep.characterWidth) / 2;
        return [direction, {
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
            thirdStep.bottom
          ) - Math.min(firstStep.bottom, neutralStep.bottom, thirdStep.bottom)
        }];
      })
    );
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
        leftRightFaceWidthDifferenceRatio:
          Math.abs(leftMedianFaceWidth - rightMedianFaceWidth) / profileMedianFaceWidth
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
        )
      },
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
  const rigFailures = frames.filter((frame) => (
    Math.abs(frame.characterHeight - policy.contentHeight) > 1
    || Math.abs(frame.bottom - policy.footBaseline) > 1
    || Math.abs(frame.headHeightDelta) > 1
    || Math.abs(frame.measuredBodyHeight - (policy.contentHeight - policy.headHeight)) > 1
    || Math.abs(frame.headWidthDelta) > 2
    || !frame.rigHashMatches
  ));
  const opticalFaceFailures = presets.filter((preset) => (
    preset.opticalFace.frontToProfileFaceWidthRatio
      > maximumFrontToProfileFaceWidthRatio
    || preset.opticalFace.leftRightFaceWidthDifferenceRatio
      > maximumLeftRightFaceWidthDifferenceRatio
  ));
  const opticalLandmarkFailures = presets.filter((preset) => (
    preset.opticalLandmarks.centerYSpreadRatio > maximumFacialLandmarkVerticalSpreadRatio
    || preset.opticalLandmarks.bottomYSpreadRatio > maximumFacialLandmarkVerticalSpreadRatio
  ));
  const motionFailures = presets.filter((preset) => (
    preset.motion.maximumStrideSilhouetteSymmetryRatio
      > maximumStrideSilhouetteSymmetryRatio
    || preset.motion.leftRightStrideExpansionDifferenceRatio
      > maximumLeftRightStrideExpansionDifferenceRatio
    || preset.motion.maximumCenterDrift > maximumStrideCenterDrift
    || preset.motion.maximumStepBaselineSpread > maximumStepBaselineSpread
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
  const report = {
    version: 4,
    policy: {
      source: policy.source,
      contentHeight: policy.contentHeight,
      headHeight: policy.headHeight,
      bodyHeight: policy.contentHeight - policy.headHeight,
      headWidth: policy.headWidth,
      footBaseline: policy.footBaseline,
      maximumHeadWidthDelta: 2,
      maximumHeadHeightDelta: 1,
      maximumDirectionHeadHeightSpread: 2,
      maximumFrontToProfileFaceWidthRatio,
      maximumLeftRightFaceWidthDifferenceRatio,
      maximumFacialLandmarkVerticalSpreadRatio,
      maximumStrideSilhouetteSymmetryRatio,
      maximumLeftRightStrideExpansionDifferenceRatio,
      maximumStrideCenterDrift,
      maximumStepBaselineSpread,
      faceLandmarkRule: "alpha top to detected chin skin boundary",
      opticalFaceRule: "median visible skin width by down, left, and right direction",
      opticalLandmarkRule: "median visible face center and chin anchors by visible direction",
      motionRule: "symmetric first and third steps, matched side stride, stable center and baseline"
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
      measuredHeadHeightWithinTolerance: frames.every(
        (frame) => Math.abs(frame.headHeightDelta) <= 1
      ),
      landmarkFrameCount,
      consensusFrameCount,
      rigHashesMatch: frames.every((frame) => frame.rigHashMatches),
      maximumMeasuredFrontToProfileFaceWidthRatio: Math.max(
        ...presets.map((preset) => preset.opticalFace.frontToProfileFaceWidthRatio)
      ),
      maximumMeasuredLeftRightFaceWidthDifferenceRatio: Math.max(
        ...presets.map((preset) => preset.opticalFace.leftRightFaceWidthDifferenceRatio)
      ),
      opticalFaceWidthWithinTolerance: opticalFaceFailures.length === 0,
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
      passed: rigFailures.length === 0
        && opticalFaceFailures.length === 0
        && opticalLandmarkFailures.length === 0
        && motionFailures.length === 0
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
        + `left/right=${preset.opticalFace.leftRightFaceWidthDifferenceRatio.toFixed(3)}`
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
    throw new Error(
      `선택 화면 3등신·얼굴·보행 감사 실패: ${rigFailures.length}개 프레임, `
      + `${opticalFaceFailures.length}명 얼굴 폭, `
      + `${opticalLandmarkFailures.length}명 얼굴 기준선, `
      + `${motionFailures.length}명 보행 (${rigDetails || "리그 통과"}; `
      + `${opticalFaceDetails || "얼굴 폭 통과"}; `
      + `${opticalLandmarkDetails || "얼굴 기준선 통과"}; `
      + `${motionDetails || "보행 통과"})`
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
        <text x="4" y="36" font-family="sans-serif" font-size="8" fill="#8b7d76">1 · 2 · 3</text>
      </svg>`);
      composites.push({ input: directionLabel, left: cardX + 10, top: rowY });
      for (let column = 0; column < 3; column += 1) {
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
  outputRoot = defaultOutputRoot
} = {}) {
  const catalog = providedCatalog ?? JSON.parse(await readFile(catalogPath, "utf8"));
  const storedReport = JSON.parse(
    await readFile(path.join(outputRoot, "selection-preview-audit.json"), "utf8")
  );
  if (storedReport.version !== 4) {
    throw new Error("방향별 얼굴 기준선·보행 리듬 기반 3등신 감사 보고서를 다시 생성해야 합니다.");
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
  return inspectPreviewSheets({ catalog, outputRoot, sourceRig });
}

export async function buildGuestSelectionPreviewAssets({
  catalog: providedCatalog,
  outputRoot = defaultOutputRoot,
  runtimeOutputRoot = defaultRuntimeOutputRoot,
  walkSourceRoot = defaultWalkSourceRoot,
  walkSourceOverrideRoot = defaultWalkSourceOverrideRoot,
  walkSourceFaceOverrideRoot = defaultWalkSourceFaceOverrideRoot,
  walkSourcePolishOverrideRoot = defaultWalkSourcePolishOverrideRoot,
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
    const { source, sourceSet } = await resolveWalkSource({
      guest,
      walkSourceRoot,
      walkSourceOverrideRoot,
      walkSourceFaceOverrideRoot,
      walkSourcePolishOverrideRoot
    });
    const sourceGrid = await loadWalkSheetGrid(source);
    const baseFramesByDirection = {};
    const detectedLandmarks = [];
    for (let row = 0; row < directions.length; row += 1) {
      const direction = directions[row];
      baseFramesByDirection[direction] = [];
      for (let column = 0; column < 3; column += 1) {
        const extracted = await extractWalkCell(sourceGrid, row, column);
        const normalized = await normalizeSelectionPreviewBaseFrame(extracted, policy);
        let landmark = null;
        if (direction !== "up") {
          try {
            landmark = await detectFaceLandmark(normalized, policy);
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
      for (let column = 0; column < 3; column += 1) {
        const baseFrame = baseFramesByDirection[direction][column];
        const sourceMeasuredHeadHeight = baseFrame.landmark?.headHeight
          ?? upSourceHeadHeightConsensus;
        let sourceHeadHeight = sourceMeasuredHeadHeight;
        const renderCandidate = async (candidateHeadHeight) => {
          const rigged = await normalizeVerticalRig(
            baseFrame.normalized,
            policy,
            candidateHeadHeight
          );
          const candidate = await normalizeHeadWidth(rigged, policy);
          const measuredHeadHeight = baseFrame.landmark
            ? (await detectFaceLandmark(candidate, policy)).headHeight
            : policy.headHeight;
          return { candidate, candidateHeadHeight, measuredHeadHeight };
        };
        let best = await renderCandidate(sourceHeadHeight);
        if (baseFrame.landmark && best.measuredHeadHeight !== policy.headHeight) {
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
          sourceDetectionMethod: baseFrame.landmark
            ? "face-landmark"
            : "cross-direction-consensus",
          sourceFaceBottom: baseFrame.landmark?.faceBottom ?? null
        });
        await writePng(
          path.join(
            frameReviewRoot,
            guest,
            direction,
            `step-${String(column + 1).padStart(2, "0")}.png`
          ),
          normalized
        );
      }
    }
    const previewWalkComposites = [];
    const runtimeWalkComposites = [];
    for (let row = 0; row < directions.length; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const previewFrame = framesByDirection[directions[row]][column];
        const runtimeFrame = await normalizeRuntimeFrame(previewFrame, policy, runtimePolicy);
        previewWalkComposites.push({
          input: previewFrame,
          left: column * policy.source.width,
          top: row * policy.source.height
        });
        runtimeWalkComposites.push({
          input: runtimeFrame,
          left: column * runtimePolicy.width,
          top: row * runtimePolicy.height
        });
      }
    }
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
    walkSourcePolishOverrideRoot
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
    `평면 3등신 선택·게임 캐릭터 생성 완료: ${result.report.summary.presetCount}명 · `
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
