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
    && red - blue > 14
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
  const faceBottom = Math.max(...faceCluster.map((component) => component.bottom));
  const headHeight = faceBottom - bounds.top + 1;
  if (headHeight < Math.round(policy.headHeight * 0.7)
    || headHeight > Math.round(policy.headHeight * 1.4)) {
    throw new Error(`실제 머리 높이 ${headHeight}px가 안전한 교정 범위를 벗어났습니다.`);
  }
  return {
    characterTop: bounds.top,
    faceBottom,
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
  return normalizeHeadWidth(normalized, runtimePolicy);
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
    top: bounds.top,
    bottom: bounds.bottom,
    characterHeight: bounds.height,
    measuredHeadHeight,
    measuredBodyHeight,
    measuredBodyToHeadRatio: measuredBodyHeight / measuredHeadHeight,
    headHeightDelta: measuredHeadHeight - policy.headHeight,
    headWidth: measuredHeadWidth,
    headWidthDelta: measuredHeadWidth - policy.headWidth,
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
    presets.push({
      id: preset.id,
      guest: preset.reference.walkSourceGuest,
      upSourceHeadHeightConsensus: presetRig.upSourceHeadHeightConsensus,
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
  const failures = frames.filter((frame) => (
    Math.abs(frame.characterHeight - policy.contentHeight) > 1
    || Math.abs(frame.bottom - policy.footBaseline) > 1
    || Math.abs(frame.headHeightDelta) > 1
    || Math.abs(frame.measuredBodyHeight - (policy.contentHeight - policy.headHeight)) > 1
    || Math.abs(frame.headWidthDelta) > 2
    || !frame.rigHashMatches
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
    version: 2,
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
      faceLandmarkRule: "alpha top to detected chin skin boundary"
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
      passed: failures.length === 0
    },
    presets
  };
  if (!report.summary.passed) {
    const details = failures
      .map((frame) =>
        `${frame.presetId}/${frame.direction}/step-${frame.step}: `
        + `height=${frame.characterHeight}, bottom=${frame.bottom}, `
        + `headHeight=${frame.measuredHeadHeight}, headWidth=${frame.headWidth}, `
        + `rigHash=${frame.rigHashMatches}`
      )
      .join("; ");
    throw new Error(`선택 화면 3등신·머리 크기 감사 실패: ${failures.length}개 프레임 (${details})`);
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
  if (storedReport.version !== 2) {
    throw new Error("실제 턱선 기반 3등신 감사 보고서를 다시 생성해야 합니다.");
  }
  const sourceRig = Object.fromEntries(storedReport.presets.map((preset) => [
    preset.id,
    {
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
    const source = path.join(walkSourceRoot, `${guest}-walk-sheet.png`);
    await access(source);
    const sourceGrid = await loadWalkSheetGrid(source);
    const baseFramesByDirection = {};
    const detectedLandmarks = [];
    for (let row = 0; row < directions.length; row += 1) {
      const direction = directions[row];
      baseFramesByDirection[direction] = [];
      for (let column = 0; column < 3; column += 1) {
        const extracted = await extractWalkCell(sourceGrid, row, column);
        const normalized = await normalizeSelectionPreviewBaseFrame(extracted, policy);
        const landmark = direction === "up"
          ? null
          : await detectFaceLandmark(normalized, policy);
        baseFramesByDirection[direction].push({ normalized, landmark });
        if (landmark) detectedLandmarks.push(landmark.headHeight);
      }
    }
    const upSourceHeadHeightConsensus = Math.round(median(detectedLandmarks));
    sourceRig[preset.id] = {
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
  return { report, reviewPath, outputRoot, runtimeOutputRoot, walkSourceRoot };
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
