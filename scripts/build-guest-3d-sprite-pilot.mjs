#!/usr/bin/env node

import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (!token.startsWith("--")) continue;
  const [key, inlineValue] = token.slice(2).split("=", 2);
  const value = inlineValue ?? process.argv[index + 1];
  args.set(key, value);
  if (inlineValue === undefined) index += 1;
}

const GUEST_ID = args.get("guest") ?? "guest-01";
const PRESET_ID = args.get("preset") ?? "feminine-long-wave-dress";
const NEEDS_RIGHT_HAND_ACCESSORY_AUDIT = GUEST_ID === "guest-01";
const MAX_REAR_HAIR_HEIGHT_DELTA = GUEST_ID === "guest-01" ? 1 : 3;
const MAX_DIRECTION_HEAD_WIDTH_RATIO = 1.1;
const MAX_STEP_HEAD_WIDTH_DELTA = 2;
const TARGET_HEAD_RATIO = 1 / 3;
const MAX_HEAD_WIDTH_SCALE = GUEST_ID === "guest-12" ? 1.7 : 1.38;
const MAX_THREE_HEAD_DIRECTION_RATIO = 1.03;
const MIN_THREE_HEAD_ASPECT_RATIO = 0.97;
const MAX_THREE_HEAD_ASPECT_RATIO = 1.03;
const MAX_THREE_HEAD_PIXEL_DELTA = 1;
const DEFAULT_SOURCE_HEAD_RATIOS = {
  down: TARGET_HEAD_RATIO,
  left: TARGET_HEAD_RATIO,
  right: TARGET_HEAD_RATIO,
  up: TARGET_HEAD_RATIO
};
const SOURCE_HEAD_RATIO_OVERRIDES = {
  "guest-12": { down: 0.27, left: 0.23, right: 0.2, up: 0.31 }
};
const SOURCE_RENDER_DIGESTS = {
  "guest-01": "8a37e0b41b5164ff3b29befe4e45ff694cfebaf28c72b3ff5ad21c4052d79f0a",
  "guest-02": "64cc4450fed6bd322bc1c6a6697042041af28470e26347747249eb7567887e22",
  "guest-03": "fcad165ab554df32c9147c82abebabfdb984557667d96ed4d033479a9551b19d",
  "guest-04": "df1ec955631b56b6dc3888ba6b2d2fdc09434cbf96346902172488622c83ada0",
  "guest-05": "0744313fdd069b181c58011d809845debb39177fad12d779fe5ec98df5928660",
  "guest-06": "26f521091c267036bca70695ede715406ab516ef474090247c8449d061e11522",
  "guest-07": "b88ad2368f7c8bc3f834bd9a98e1d7b978a57d96282dbf42110940e0dade02fd",
  "guest-08": "743cf0f9445fc32f14b33df004864d3523bcf6bb3292bf9699e1da3cb37aac24",
  "guest-09": "460653af2cd474b5b02d3b8e986d88af5d1a77efe7ffbf2ac0365de94f82757c",
  "guest-10": "520f18de9caf49e893257de02deb0fb0ac0caf93a561803916376f324c502224",
  "guest-11": "e23659fdcd1e4e3b48aadd3e45762ab4abb3ab1469553f75faa8b31f7d06b6cb",
  "guest-12": "ffc56fbf7c4286886c45f8d4b2985e2dd4b89f5e5adfeea3d32623609b5586a3"
};
const ABSOLUTE_HEAD_WIDTH_RATIO_OVERRIDES = { "guest-12": TARGET_HEAD_RATIO };
const DIRECTIONS = ["down", "left", "right", "up"];
const FRAME = { width: 96, height: 144 };
const SOURCE = { width: 640, height: 1024, foregroundHeight: 820, baseline: 930 };
const FOOT_BOTTOM = 132;
const CONTENT_HEIGHT = 127;
const FOOT_ZONE_TOP = 112;
const FOOT_COMPARE_TOP = 114;
const MAX_SIDE_NEUTRAL_SPAN_RATIO = 0.75;
const MIN_SIDE_ALTERNATION_DIFFERENCE = 0.04;
const MAX_VERTICAL_MIRROR_DIFFERENCE = 0.01;
const MIN_VERTICAL_POSE_DIFFERENCE = 0.07;
const MIN_VERTICAL_NEUTRAL_DIFFERENCE = 0.065;
const INPUT_ROOT = path.join(
  ROOT,
  "character-assets/reference/guest-3d-master-sources/v1",
  GUEST_ID,
  "walk-renders"
);
const OUTPUT_ROOT = path.join(
  ROOT,
  "character-assets/reference/guest-3d-master-sources/v1",
  GUEST_ID,
  "pilot"
);
const CURRENT_WALK = path.join(
  ROOT,
  `character-assets/source/guests/${PRESET_ID}__walk.png`
);

async function alphaBounds(input, threshold = 8) {
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

  if (right < left || bottom < top) throw new Error("투명하지 않은 캐릭터 픽셀을 찾지 못했습니다.");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function splitDirectionSheet(direction) {
  const input = path.join(INPUT_ROOT, `${direction}-walk-cycle-render.png`);
  const metadata = await sharp(input).metadata();
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const occupiedColumns = new Array(info.width).fill(false);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 8) occupiedColumns[x] = true;
    }
  }

  const foregroundRuns = [];
  let runStart = -1;
  for (let x = 0; x <= occupiedColumns.length; x += 1) {
    if (x < occupiedColumns.length && occupiedColumns[x]) {
      if (runStart < 0) runStart = x;
      continue;
    }
    if (runStart >= 0) {
      foregroundRuns.push({ left: runStart, right: x - 1 });
      runStart = -1;
    }
  }

  const panelRanges = foregroundRuns.length === 3
    ? foregroundRuns.map(({ left, right }) => ({
        left: Math.max(0, left - 4),
        right: Math.min(metadata.width, right + 5)
      }))
    : Array.from({ length: 3 }, (_, step) => ({
        left: Math.floor((metadata.width * step) / 3),
        right: Math.floor((metadata.width * (step + 1)) / 3)
      }));
  const frames = [];

  for (let step = 0; step < 3; step += 1) {
    const panelLeft = panelRanges[step].left;
    const panelRight = panelRanges[step].right;
    const panel = await sharp(input)
      .extract({ left: panelLeft, top: 0, width: panelRight - panelLeft, height: metadata.height })
      .png()
      .toBuffer();
    const bounds = await alphaBounds(panel);
    const padding = 3;
    const left = Math.max(0, bounds.left - padding);
    const top = Math.max(0, bounds.top - padding);
    const width = Math.min(panelRight - panelLeft - left, bounds.width + padding * 2);
    const height = Math.min(metadata.height - top, bounds.height + padding * 2);
    frames.push(await sharp(panel).extract({ left, top, width, height }).png().toBuffer());
  }

  return frames;
}

async function sourceRenderDigest() {
  const hash = createHash("sha256");
  for (const direction of DIRECTIONS) {
    hash.update(await fs.readFile(path.join(INPUT_ROOT, `${direction}-walk-cycle-render.png`)));
  }
  return hash.digest("hex");
}

async function canvas(width, height, composites) {
  return sharp({
    create: { width, height, channels: 4, background: "#00000000" }
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function visibleFrame(frame) {
  const bounds = await alphaBounds(frame);
  const cropped = await sharp(frame)
    .extract(bounds)
    .png()
    .toBuffer();
  return { image: cropped, width: bounds.width, height: bounds.height };
}

async function headBandMetrics(frame, threshold = 12) {
  const bounds = await alphaBounds(frame, threshold);
  const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bottom = Math.min(info.height - 1, bounds.top + Math.round(bounds.height / 3));
  let left = info.width;
  let right = -1;
  let top = info.height;

  for (let y = bounds.top; y <= bottom; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] <= threshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
    }
  }

  if (right < left) throw new Error("머리 영역의 불투명 픽셀을 찾지 못했습니다.");
  const width = right - left + 1;
  return {
    left,
    right,
    top,
    bottom,
    width,
    characterHeight: bounds.height,
    normalizedWidth: width / bounds.height
  };
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function samplePremultiplied(data, info, x, y) {
  const x0 = Math.max(0, Math.min(info.width - 1, Math.floor(x)));
  const x1 = Math.max(0, Math.min(info.width - 1, x0 + 1));
  const y0 = Math.max(0, Math.min(info.height - 1, Math.floor(y)));
  const y1 = Math.max(0, Math.min(info.height - 1, y0 + 1));
  const xWeight = Math.max(0, Math.min(1, x - x0));
  const yWeight = Math.max(0, Math.min(1, y - y0));
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

async function normalizeHeadBodyHeight(frame, sourceHeadRatio) {
  if (Math.abs(sourceHeadRatio - TARGET_HEAD_RATIO) < 0.0005) return frame;
  const bounds = await alphaBounds(frame, 12);
  const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(data.length);
  const top = bounds.top;
  const bottom = bounds.top + bounds.height - 1;
  const sourceBoundary = top + (bottom - top) * sourceHeadRatio;
  const targetBoundary = top + (bottom - top) * TARGET_HEAD_RATIO;

  for (let y = top; y <= bottom; y += 1) {
    const sourceY = y <= targetBoundary
      ? top + ((y - top) / Math.max(1, targetBoundary - top)) * (sourceBoundary - top)
      : sourceBoundary +
        ((y - targetBoundary) / Math.max(1, bottom - targetBoundary)) * (bottom - sourceBoundary);
    for (let x = 0; x < info.width; x += 1) {
      const sampled = samplePremultiplied(data, info, x, sourceY);
      output.set(sampled, (y * info.width + x) * 4);
    }
  }

  return sharp(output, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
}

async function normalizeHeadWidth(frame, scale) {
  if (Math.abs(scale - 1) < 0.005) return frame;
  const metrics = await headBandMetrics(frame);
  const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const extraWidth = Math.max(12, Math.ceil(metrics.width * Math.max(0, scale - 1)) + 12);
  const outputWidth = info.width + extraWidth;
  const output = Buffer.alloc(outputWidth * info.height * 4);
  const sourceCenter = (info.width - 1) / 2;
  const outputCenter = (outputWidth - 1) / 2;
  const transitionEnd = Math.min(
    info.height - 1,
    metrics.bottom + Math.max(4, Math.round(metrics.characterHeight * 0.08))
  );

  for (let y = 0; y < info.height; y += 1) {
    const blend = y <= metrics.bottom
      ? 0
      : y >= transitionEnd
        ? 1
        : (y - metrics.bottom) / Math.max(1, transitionEnd - metrics.bottom);
    const rowScale = scale + (1 - scale) * blend;

    for (let x = 0; x < outputWidth; x += 1) {
      const sourceX = sourceCenter + (x - outputCenter) / rowScale;
      if (sourceX < 0 || sourceX > info.width - 1) continue;
      const sampled = samplePremultiplied(data, info, sourceX, y);
      const offset = (y * outputWidth + x) * 4;
      output.set(sampled, offset);
    }
  }

  return sharp(output, {
    raw: { width: outputWidth, height: info.height, channels: 4 }
  }).png({ compressionLevel: 9 }).toBuffer();
}

async function removeTinyAlphaIslands(frame, minimumPixels = 4) {
  const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visited = new Uint8Array(info.width * info.height);

  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start] || data[start * 4 + 3] <= 8) continue;
    const stack = [start];
    const pixels = [];
    visited[start] = 1;

    while (stack.length > 0) {
      const current = stack.pop();
      const x = current % info.width;
      const y = Math.floor(current / info.width);
      pixels.push(current);

      for (const next of [current - 1, current + 1, current - info.width, current + info.width]) {
        if (next < 0 || next >= visited.length || visited[next]) continue;
        const nextX = next % info.width;
        const nextY = Math.floor(next / info.width);
        if (Math.abs(nextX - x) + Math.abs(nextY - y) !== 1) continue;
        if (data[next * 4 + 3] <= 8) continue;
        visited[next] = 1;
        stack.push(next);
      }
    }

    if (pixels.length >= minimumPixels) continue;
    for (const pixel of pixels) {
      data[pixel * 4] = 0;
      data[pixel * 4 + 1] = 0;
      data[pixel * 4 + 2] = 0;
      data[pixel * 4 + 3] = 0;
    }
  }

  return sharp(data, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
}

async function removeGreenFringe(frame) {
  const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha > 16 && green > 90 && green > red * 1.45 && green > blue * 1.45) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }
  return sharp(data, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
}

async function normalizeSource(frame) {
  const visible = await visibleFrame(frame);
  const scale = SOURCE.foregroundHeight / visible.height;
  const width = Math.min(SOURCE.width - 16, Math.max(1, Math.round(visible.width * scale)));
  const height = SOURCE.foregroundHeight;
  const resized = await sharp(visible.image)
    .resize({ width, height, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const normalized = await canvas(SOURCE.width, SOURCE.height, [
    {
      input: resized,
      left: Math.round((SOURCE.width - width) / 2),
      top: SOURCE.baseline - height + 1
    }
  ]);
  return removeTinyAlphaIslands(normalized, 32);
}

async function normalizeGameFrame(frame, mode) {
  const visible = await visibleFrame(frame);
  const targetHeight = mode === "pixel" ? CONTENT_HEIGHT - 1 : CONTENT_HEIGHT;
  const scale = targetHeight / visible.height;
  let width = Math.min(FRAME.width - 4, Math.max(2, Math.round(visible.width * scale)));
  let height = targetHeight;
  let resized;

  if (mode === "pixel") {
    width -= width % 2;
    height -= height % 2;
    const lowWidth = Math.max(1, width / 2);
    const lowHeight = Math.max(1, height / 2);
    const lowResolution = await sharp(visible.image)
      .resize({ width: lowWidth, height: lowHeight, fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png({ palette: true, colours: 96, dither: 0.35 })
      .toBuffer();
    resized = await sharp(lowResolution)
      .resize({ width, height, fit: "fill", kernel: sharp.kernel.nearest })
      .png()
      .toBuffer();
  } else {
    resized = await sharp(visible.image)
      .resize({ width, height, fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
  }

  const normalized = await canvas(FRAME.width, FRAME.height, [
    {
      input: resized,
      left: Math.round((FRAME.width - width) / 2),
      top: FOOT_BOTTOM - height + 1
    }
  ]);
  return removeTinyAlphaIslands(normalized);
}

async function saveBuffer(file, buffer) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buffer);
}

async function replaceLowerWithMirroredStep(target, source, startY) {
  const metadata = await sharp(target).metadata();
  const seamOverlap = Math.max(2, Math.round(metadata.height * 0.008));
  const upperBottom = Math.min(metadata.height, startY + seamOverlap);
  const lowerTop = Math.max(0, startY - seamOverlap);
  const upper = await sharp(target)
    .extract({ left: 0, top: 0, width: metadata.width, height: upperBottom })
    .png()
    .toBuffer();
  const mirroredLower = await sharp(source)
    .extract({ left: 0, top: lowerTop, width: metadata.width, height: metadata.height - lowerTop })
    .flop()
    .png()
    .toBuffer();
  const composited = await canvas(metadata.width, metadata.height, [
    { input: upper, left: 0, top: 0 },
    { input: mirroredLower, left: 0, top: lowerTop }
  ]);
  return removeTinyAlphaIslands(composited, metadata.width > FRAME.width ? 32 : 4);
}

async function footZoneMetrics(frame) {
  const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let right = -1;
  let pixels = 0;

  for (let y = FOOT_ZONE_TOP; y <= FOOT_BOTTOM; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] <= 16) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      pixels += 1;
    }
  }

  return { left, right, span: right >= left ? right - left + 1 : 0, pixels };
}

async function lowerPoseDifference(first, second, mirrorSecond = false) {
  const [firstRaw, secondRaw] = await Promise.all([
    sharp(first).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(second).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  if (firstRaw.info.width !== secondRaw.info.width || firstRaw.info.height !== secondRaw.info.height) {
    throw new Error("보행 하체 비교 프레임 크기가 일치하지 않습니다.");
  }

  const width = firstRaw.info.width;
  let unionPixels = 0;
  let alphaDifferencePixels = 0;
  let rgbaDifference = 0;
  for (let y = FOOT_COMPARE_TOP; y <= FOOT_BOTTOM; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const firstOffset = (y * width + x) * 4;
      const secondX = mirrorSecond ? width - 1 - x : x;
      const secondOffset = (y * width + secondX) * 4;
      const firstOpaque = firstRaw.data[firstOffset + 3] > 16;
      const secondOpaque = secondRaw.data[secondOffset + 3] > 16;
      if (!firstOpaque && !secondOpaque) continue;
      unionPixels += 1;
      if (firstOpaque !== secondOpaque) alphaDifferencePixels += 1;
      for (let channel = 0; channel < 4; channel += 1) {
        rgbaDifference += Math.abs(firstRaw.data[firstOffset + channel] - secondRaw.data[secondOffset + channel]);
      }
    }
  }

  return {
    alpha: unionPixels === 0 ? 0 : alphaDifferencePixels / unionPixels,
    rgba: unionPixels === 0 ? 0 : rgbaDifference / (unionPixels * 4 * 255)
  };
}

async function repairSideStepAlternation(framesByDirection, sourceFrames) {
  const originals = {
    left: { game: [...framesByDirection.left], source: [...sourceFrames.left] },
    right: { game: [...framesByDirection.right], source: [...sourceFrames.right] }
  };
  const repairs = [];

  for (const direction of ["left", "right"]) {
    const opposite = direction === "left" ? "right" : "left";
    const current = await lowerPoseDifference(
      originals[direction].game[0].soft,
      originals[direction].game[2].soft
    );
    if (
      current.alpha >= MIN_SIDE_ALTERNATION_DIFFERENCE &&
      current.rgba >= MIN_SIDE_ALTERNATION_DIFFERENCE
    ) continue;

    let best = null;
    for (const sourceIndex of [0, 2]) {
      const candidate = await replaceLowerWithMirroredStep(
        originals[direction].game[2].soft,
        originals[opposite].game[sourceIndex].soft,
        FOOT_ZONE_TOP
      );
      const difference = await lowerPoseDifference(originals[direction].game[0].soft, candidate);
      const neutral = await footZoneMetrics(originals[direction].game[1].soft);
      const stride = await footZoneMetrics(candidate);
      const score = difference.alpha + difference.rgba + Math.max(0, stride.span - neutral.span) / FRAME.width;
      if (!best || score > best.score) best = { sourceIndex, score };
    }

    const sourceIndex = best.sourceIndex;
    sourceFrames[direction][2] = await replaceLowerWithMirroredStep(
      originals[direction].source[2],
      originals[opposite].source[sourceIndex],
      820
    );
    for (const mode of ["soft", "pixel"]) {
      framesByDirection[direction][2][mode] = await replaceLowerWithMirroredStep(
        originals[direction].game[2][mode],
        originals[opposite].game[sourceIndex][mode],
        FOOT_ZONE_TOP
      );
    }
    repairs.push({ direction, step: 3, mirroredFromDirection: opposite, mirroredFromStep: sourceIndex + 1 });
  }

  return repairs;
}

async function gaitCycleAudit(framesByDirection, repairs) {
  const directions = {};
  for (const direction of DIRECTIONS) {
    const frames = framesByDirection[direction].map((item) => item.soft);
    const feet = await Promise.all(frames.map((frame) => footZoneMetrics(frame)));
    if (direction === "left" || direction === "right") {
      const alternation = await lowerPoseDifference(frames[0], frames[2]);
      const neutralSpanRatio = feet[1].span / Math.max(1, Math.min(feet[0].span, feet[2].span));
      directions[direction] = {
        footSpans: feet.map((item) => item.span),
        neutralSpanRatio,
        alternation,
        passed:
          neutralSpanRatio <= MAX_SIDE_NEUTRAL_SPAN_RATIO &&
          alternation.alpha >= MIN_SIDE_ALTERNATION_DIFFERENCE &&
          alternation.rgba >= MIN_SIDE_ALTERNATION_DIFFERENCE
      };
      continue;
    }

    const mirroredAlternation = await lowerPoseDifference(frames[0], frames[2], true);
    const directAlternation = await lowerPoseDifference(frames[0], frames[2]);
    const neutralDifference = await lowerPoseDifference(frames[0], frames[1]);
    directions[direction] = {
      footSpans: feet.map((item) => item.span),
      mirroredAlternation,
      directAlternation,
      neutralDifference,
      passed:
        mirroredAlternation.alpha <= MAX_VERTICAL_MIRROR_DIFFERENCE &&
        mirroredAlternation.rgba <= MAX_VERTICAL_MIRROR_DIFFERENCE &&
        directAlternation.rgba >= MIN_VERTICAL_POSE_DIFFERENCE &&
        neutralDifference.rgba >= MIN_VERTICAL_NEUTRAL_DIFFERENCE
    };
  }

  return {
    repairs,
    directions,
    passed: Object.values(directions).every((direction) => direction.passed)
  };
}

async function buildSheet(framesByDirection, mode) {
  const composites = [];
  for (let row = 0; row < DIRECTIONS.length; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      composites.push({
        input: framesByDirection[DIRECTIONS[row]][column][mode],
        left: column * FRAME.width,
        top: row * FRAME.height
      });
    }
  }
  return canvas(FRAME.width * 3, FRAME.height * DIRECTIONS.length, composites);
}

function labelSvg(text, width, height = 28) {
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#fffaf4"/>
    <text x="8" y="19" font-family="sans-serif" font-size="13" fill="#2e241f">${escaped}</text>
  </svg>`);
}

async function checkerboard(width, height, size = 12) {
  const data = Buffer.alloc(width * height * 4);
  const colors = [[246, 241, 235, 255], [218, 211, 202, 255]];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = colors[(Math.floor(x / size) + Math.floor(y / size)) % 2];
      const offset = (y * width + x) * 4;
      data.set(color, offset);
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function renderComparison(framesByDirection) {
  const scale = 2;
  const sampleWidth = FRAME.width * scale;
  const sampleHeight = FRAME.height * scale;
  const labelHeight = 28;
  const rowGap = 18;
  const margin = 20;
  const groupGap = 18;
  const groupWidth = sampleWidth * 3;
  const width = margin * 2 + groupWidth * 3 + groupGap * 2;
  const rowHeight = labelHeight + sampleHeight;
  const height = margin * 2 + DIRECTIONS.length * rowHeight + (DIRECTIONS.length - 1) * rowGap;
  const checker = await checkerboard(sampleWidth, sampleHeight);
  const composites = [];

  for (let row = 0; row < DIRECTIONS.length; row += 1) {
    const direction = DIRECTIONS[row];
    const rowTop = margin + row * (rowHeight + rowGap);
    const groups = [
      { label: `현재 픽셀 · ${direction}`, frames: [] },
      { label: `3D 선명형 · ${direction}`, frames: framesByDirection[direction].map((item) => item.soft) },
      { label: `3D 픽셀형 · ${direction}`, frames: framesByDirection[direction].map((item) => item.pixel) }
    ];

    for (let column = 0; column < 3; column += 1) {
      groups[0].frames.push(
        await sharp(CURRENT_WALK)
          .extract({ left: column * FRAME.width, top: row * FRAME.height, ...FRAME })
          .png()
          .toBuffer()
      );
    }

    for (let group = 0; group < groups.length; group += 1) {
      const groupLeft = margin + group * (groupWidth + groupGap);
      composites.push({ input: labelSvg(groups[group].label, groupWidth), left: groupLeft, top: rowTop });
      for (let step = 0; step < 3; step += 1) {
        const left = groupLeft + step * sampleWidth;
        const top = rowTop + labelHeight;
        const enlarged = await sharp(groups[group].frames[step])
          .resize({ width: sampleWidth, height: sampleHeight, kernel: sharp.kernel.nearest })
          .png()
          .toBuffer();
        composites.push({ input: checker, left, top }, { input: enlarged, left, top });
      }
    }
  }

  const output = path.join(OUTPUT_ROOT, "review", `${GUEST_ID}-pilot-comparison.png`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width, height, channels: 4, background: "#eee7dd" } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(output);
  return path.relative(ROOT, output);
}

async function renderRatioAudit(sourceFrames) {
  const scale = 0.32;
  const frameWidth = Math.round(SOURCE.width * scale);
  const frameHeight = Math.round(SOURCE.height * scale);
  const gap = 10;
  const margin = 18;
  const labelHeight = 26;
  const rowHeight = labelHeight + frameHeight;
  const width = margin * 2 + frameWidth * 3 + gap * 2;
  const height = margin * 2 + rowHeight * 4 + gap * 3;
  const guideTop = (SOURCE.baseline - SOURCE.foregroundHeight + 1) * scale;
  const oneHead = (SOURCE.foregroundHeight / 3) * scale;
  const baseline = SOURCE.baseline * scale;
  const guide = Buffer.from(`<svg width="${frameWidth}" height="${frameHeight}" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="${guideTop}" x2="${frameWidth}" y2="${guideTop}" stroke="#3b82f6" stroke-width="1.5"/>
    <line x1="0" y1="${guideTop + oneHead}" x2="${frameWidth}" y2="${guideTop + oneHead}" stroke="#ef4444" stroke-width="2"/>
    <line x1="0" y1="${guideTop + oneHead * 2}" x2="${frameWidth}" y2="${guideTop + oneHead * 2}" stroke="#f59e0b" stroke-width="1.5"/>
    <line x1="0" y1="${baseline}" x2="${frameWidth}" y2="${baseline}" stroke="#22c55e" stroke-width="2"/>
  </svg>`);
  const composites = [];

  for (let row = 0; row < DIRECTIONS.length; row += 1) {
    const direction = DIRECTIONS[row];
    const rowTop = margin + row * (rowHeight + gap);
    composites.push({ input: labelSvg(`${direction} · 턱·목 경계(빨강) · 머리 1 + 몸 2`, frameWidth * 3 + gap * 2, labelHeight), left: margin, top: rowTop });
    for (let step = 0; step < 3; step += 1) {
      const rendered = await sharp(sourceFrames[direction][step])
        .resize({ width: frameWidth, height: frameHeight, fit: "fill" })
        .composite([{ input: guide, left: 0, top: 0 }])
        .png()
        .toBuffer();
      composites.push({
        input: rendered,
        left: margin + step * (frameWidth + gap),
        top: rowTop + labelHeight
      });
    }
  }

  const output = path.join(OUTPUT_ROOT, "review", `${GUEST_ID}-ratio-audit.png`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width, height, channels: 4, background: "#f6f1eb" } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(output);
  return path.relative(ROOT, output);
}

async function inspectFrame(buffer) {
  const bounds = await alphaBounds(buffer, 12);
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let greenFringePixels = 0;
  let partialAlphaPixels = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const [red, green, blue, alpha] = data.subarray(offset, offset + 4);
    if (alpha > 0 && alpha < 255) partialAlphaPixels += 1;
    if (alpha > 16 && green > 90 && green > red * 1.45 && green > blue * 1.45) {
      greenFringePixels += 1;
    }
  }
  return { ...bounds, greenFringePixels, partialAlphaPixels, pixels: info.width * info.height };
}

async function accessorySide(frame) {
  const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = { left: 0, right: 0 };

  for (let y = 45; y < 120; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (x >= 34 && x <= 62) continue;
      const offset = (y * info.width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const alpha = data[offset + 3];
      const isBagColor =
        alpha > 80 &&
        red >= 55 && red <= 210 &&
        green >= 35 && green <= 175 &&
        blue >= 30 && blue <= 165 &&
        red > green * 1.05 &&
        green > blue * 0.82;
      if (!isBagColor) continue;
      counts[x < info.width / 2 ? "left" : "right"] += 1;
    }
  }

  return { ...counts, detected: counts.right > counts.left ? "right" : "left" };
}

async function rearHairBounds(frame) {
  const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;
  let pixels = 0;

  for (let y = 0; y < Math.min(56, info.height); y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const alpha = data[offset + 3];
      const isWarmHair =
        alpha > 80 &&
        red >= 18 && red < 145 &&
        green >= 8 && green < 105 &&
        blue < 90 &&
        red > green * 1.12 &&
        green > blue * 0.85;
      const isNeutralDarkHair =
        alpha > 80 &&
        red < 115 &&
        green < 115 &&
        blue < 120 &&
        Math.max(red, green, blue) - Math.min(red, green, blue) <= 48;
      const isHairColor = isWarmHair || isNeutralDarkHair;
      if (!isHairColor) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      pixels += 1;
    }
  }

  return { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1, pixels };
}

async function main() {
  const framesByDirection = {};
  const sourceFrames = {};
  const audit = { guest: GUEST_ID, frameSize: FRAME, directions: {} };

  const rawFramesByDirection = {};
  const rawHeadWidthsByDirection = {};
  const sourceHeadRatios = SOURCE_HEAD_RATIO_OVERRIDES[GUEST_ID] ?? DEFAULT_SOURCE_HEAD_RATIOS;
  const actualSourceRenderDigest = await sourceRenderDigest();
  if (SOURCE_RENDER_DIGESTS[GUEST_ID] !== actualSourceRenderDigest) {
    throw new Error(`${GUEST_ID} 원본 3D 렌더가 변경되어 턱·목 경계 재측정이 필요합니다.`);
  }
  for (const direction of DIRECTIONS) {
    rawFramesByDirection[direction] = await splitDirectionSheet(direction);
    rawFramesByDirection[direction] = await Promise.all(
      rawFramesByDirection[direction].map((frame) =>
        normalizeHeadBodyHeight(frame, sourceHeadRatios[direction])
      )
    );
    const metrics = await Promise.all(rawFramesByDirection[direction].map((frame) => headBandMetrics(frame)));
    rawHeadWidthsByDirection[direction] = metrics.map((item) => item.normalizedWidth);
  }
  const targetHeadWidth =
    ABSOLUTE_HEAD_WIDTH_RATIO_OVERRIDES[GUEST_ID] ??
    median(Object.values(rawHeadWidthsByDirection).flat());
  const headScalesByDirection = Object.fromEntries(
    DIRECTIONS.map((direction) => [
      direction,
      rawHeadWidthsByDirection[direction].map((width) =>
        Math.max(0.72, Math.min(MAX_HEAD_WIDTH_SCALE, targetHeadWidth / width))
      )
    ])
  );

  let previewTargetWidth = null;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const previewWidthsByDirection = {};
    for (const direction of DIRECTIONS) {
      const previews = await Promise.all(
        rawFramesByDirection[direction].map(async (frame, index) => {
          const adjusted = await normalizeHeadWidth(frame, headScalesByDirection[direction][index]);
          return normalizeGameFrame(adjusted, "soft");
        })
      );
      previewWidthsByDirection[direction] = await Promise.all(
        previews.map(async (frame) => (await headBandMetrics(frame)).width)
      );
    }
    previewTargetWidth = median(Object.values(previewWidthsByDirection).flat());
    for (const direction of DIRECTIONS) {
      for (let index = 0; index < headScalesByDirection[direction].length; index += 1) {
        const correction = previewTargetWidth / previewWidthsByDirection[direction][index];
        headScalesByDirection[direction][index] = Math.max(
          0.72,
          Math.min(MAX_HEAD_WIDTH_SCALE, headScalesByDirection[direction][index] * correction)
        );
      }
    }
  }

  audit.headWidthNormalization = {
    targetNormalizedWidth: targetHeadWidth,
    targetGameFrameWidth: previewTargetWidth,
    sourceFrameWidths: rawHeadWidthsByDirection,
    scaleByFrame: headScalesByDirection
  };
  audit.verticalRatioNormalization = {
    boundary: "anatomical-chin-or-neck",
    sourceRenderDigest: actualSourceRenderDigest,
    sourceHeadRatios,
    targetHeadRatio: TARGET_HEAD_RATIO,
    targetBodyRatio: 1 - TARGET_HEAD_RATIO
  };

  for (const direction of DIRECTIONS) {
    const splitFrames = await Promise.all(
      rawFramesByDirection[direction].map((frame, index) =>
        normalizeHeadWidth(frame, headScalesByDirection[direction][index])
      )
    );
    framesByDirection[direction] = [];
    sourceFrames[direction] = [];
    audit.directions[direction] = [];

    for (let step = 0; step < splitFrames.length; step += 1) {
      const number = String(step + 1).padStart(2, "0");
      const source = await removeGreenFringe(await normalizeSource(splitFrames[step]));
      const soft = await removeGreenFringe(await normalizeGameFrame(splitFrames[step], "soft"));
      const pixel = await removeGreenFringe(await normalizeGameFrame(splitFrames[step], "pixel"));
      sourceFrames[direction].push(source);
      framesByDirection[direction].push({ soft, pixel });

      await saveBuffer(path.join(OUTPUT_ROOT, "sources", direction, `step-${number}-source.png`), source);
      await saveBuffer(path.join(OUTPUT_ROOT, "frames", "soft", direction, `step-${number}.png`), soft);
      await saveBuffer(path.join(OUTPUT_ROOT, "frames", "pixel", direction, `step-${number}.png`), pixel);
      audit.directions[direction].push({
        step: step + 1,
        soft: await inspectFrame(soft),
        pixel: await inspectFrame(pixel)
      });
    }

    if (direction === "down" || direction === "up") {
      sourceFrames[direction][2] = await replaceLowerWithMirroredStep(
        sourceFrames[direction][2],
        sourceFrames[direction][0],
        820
      );
      for (const mode of ["soft", "pixel"]) {
        framesByDirection[direction][2][mode] = await replaceLowerWithMirroredStep(
          framesByDirection[direction][2][mode],
          framesByDirection[direction][0][mode],
          112
        );
      }
      await saveBuffer(
        path.join(OUTPUT_ROOT, "sources", direction, "step-03-source.png"),
        sourceFrames[direction][2]
      );
      await saveBuffer(
        path.join(OUTPUT_ROOT, "frames", "soft", direction, "step-03.png"),
        framesByDirection[direction][2].soft
      );
      await saveBuffer(
        path.join(OUTPUT_ROOT, "frames", "pixel", direction, "step-03.png"),
        framesByDirection[direction][2].pixel
      );
      audit.directions[direction][2] = {
        step: 3,
        soft: await inspectFrame(framesByDirection[direction][2].soft),
        pixel: await inspectFrame(framesByDirection[direction][2].pixel)
      };
    }
  }

  const gaitRepairs = await repairSideStepAlternation(framesByDirection, sourceFrames);
  for (const repair of gaitRepairs) {
    const direction = repair.direction;
    await saveBuffer(
      path.join(OUTPUT_ROOT, "sources", direction, "step-03-source.png"),
      sourceFrames[direction][2]
    );
    for (const mode of ["soft", "pixel"]) {
      await saveBuffer(
        path.join(OUTPUT_ROOT, "frames", mode, direction, "step-03.png"),
        framesByDirection[direction][2][mode]
      );
    }
    audit.directions[direction][2] = {
      step: 3,
      soft: await inspectFrame(framesByDirection[direction][2].soft),
      pixel: await inspectFrame(framesByDirection[direction][2].pixel)
    };
  }

  for (const mode of ["soft", "pixel"]) {
    const walk = await buildSheet(framesByDirection, mode);
    await saveBuffer(path.join(OUTPUT_ROOT, `${GUEST_ID}__walk-${mode}-pilot.png`), walk);
    const idle = await canvas(FRAME.width * 2, FRAME.height, [
      { input: framesByDirection.down[1][mode], left: 0, top: 0 },
      { input: framesByDirection.down[1][mode], left: FRAME.width, top: 0 }
    ]);
    await saveBuffer(path.join(OUTPUT_ROOT, `${GUEST_ID}__idle-${mode}-pilot.png`), idle);
  }

  audit.review = await renderComparison(framesByDirection);
  audit.ratioAudit = await renderRatioAudit(sourceFrames);
  audit.acceptance = {
    frameCount: Object.values(audit.directions).flat().length,
    allFrameSizesMatch: Object.values(audit.directions).flat().every((item) =>
      [item.soft, item.pixel].every((frame) => frame.width <= FRAME.width && frame.height <= FRAME.height)
    ),
    greenFringePixels: Object.values(audit.directions).flat().reduce(
      (total, item) => total + item.soft.greenFringePixels + item.pixel.greenFringePixels,
      0
    ),
    rearHairConsistency: {
      frames: await Promise.all(framesByDirection.up.map((item) => rearHairBounds(item.soft)))
    },
    headSizeConsistency: {},
    gaitCycle: await gaitCycleAudit(framesByDirection, gaitRepairs)
  };
  const headWidthsByDirection = {};
  for (const direction of DIRECTIONS) {
    const metrics = await Promise.all(framesByDirection[direction].map((item) => headBandMetrics(item.soft)));
    headWidthsByDirection[direction] = {
      frames: metrics.map((item) => item.width),
      average: metrics.reduce((total, item) => total + item.width, 0) / metrics.length
    };
  }
  const directionAverages = Object.values(headWidthsByDirection).map((item) => item.average);
  const maximumStepDelta = Math.max(
    ...Object.values(headWidthsByDirection).map((item) => Math.max(...item.frames) - Math.min(...item.frames))
  );
  audit.acceptance.headSizeConsistency = {
    directions: headWidthsByDirection,
    maximumDirectionRatio: Math.max(...directionAverages) / Math.min(...directionAverages),
    maximumStepDelta,
    passed:
      Math.max(...directionAverages) / Math.min(...directionAverages) <= MAX_DIRECTION_HEAD_WIDTH_RATIO &&
      maximumStepDelta <= MAX_STEP_HEAD_WIDTH_DELTA
  };
  const neutralMetrics = await Promise.all(
    DIRECTIONS.map((direction) => headBandMetrics(framesByDirection[direction][1].soft))
  );
  const headHeights = neutralMetrics.map((item) => Math.round(item.characterHeight * TARGET_HEAD_RATIO));
  const bodyHeights = neutralMetrics.map((item, index) => item.characterHeight - headHeights[index]);
  const ratioErrorPixels = bodyHeights.map((height, index) => Math.abs(height - headHeights[index] * 2));
  audit.acceptance.threeHeadProportion = {
    boundary: "anatomical-chin-or-neck",
    directions: Object.fromEntries(
      DIRECTIONS.map((direction, index) => [direction, {
        characterHeight: neutralMetrics[index].characterHeight,
        sourceHeadRatio: sourceHeadRatios[direction],
        headHeight: headHeights[index],
        bodyHeight: bodyHeights[index],
        bodyToHeadRatio: bodyHeights[index] / headHeights[index],
        ratioErrorPixels: ratioErrorPixels[index],
        boundaryY: neutralMetrics[index].top + headHeights[index]
      }])
    ),
    maximumRatioErrorPixels: Math.max(...ratioErrorPixels),
    passed: ratioErrorPixels.every((delta) => delta <= MAX_THREE_HEAD_PIXEL_DELTA)
  };
  if (GUEST_ID === "guest-12") {
    const headAspectRatios = neutralMetrics.map((item, index) => item.width / headHeights[index]);
    const neutralHeadWidths = neutralMetrics.map((item) => item.width);
    const maximumDirectionRatio = Math.max(...neutralHeadWidths) / Math.min(...neutralHeadWidths);
    audit.acceptance.headShapeConsistency = {
      maximumDirectionRatio,
      aspectRatios: Object.fromEntries(
        DIRECTIONS.map((direction, index) => [direction, headAspectRatios[index]])
      ),
      passed:
        maximumDirectionRatio <= MAX_THREE_HEAD_DIRECTION_RATIO &&
        headAspectRatios.every(
          (ratio) => ratio >= MIN_THREE_HEAD_ASPECT_RATIO && ratio <= MAX_THREE_HEAD_ASPECT_RATIO
        )
    };
  }
  if (NEEDS_RIGHT_HAND_ACCESSORY_AUDIT) {
    audit.acceptance.rightHandAccessoryPlacement = {
      down: await Promise.all(framesByDirection.down.map((item) => accessorySide(item.soft))),
      up: await Promise.all(framesByDirection.up.map((item) => accessorySide(item.soft)))
    };
    audit.acceptance.rightHandAccessoryPlacement.passed =
      audit.acceptance.rightHandAccessoryPlacement.down.every((item) => item.detected === "left") &&
      audit.acceptance.rightHandAccessoryPlacement.up.every((item) => item.detected === "right");
  }
  const rearHairHeights = audit.acceptance.rearHairConsistency.frames.map((item) => item.height);
  const rearHairWidths = audit.acceptance.rearHairConsistency.frames.map((item) => item.width);
  audit.acceptance.rearHairConsistency.maximumHeightDelta =
    Math.max(...rearHairHeights) - Math.min(...rearHairHeights);
  audit.acceptance.rearHairConsistency.maximumWidthDelta =
    Math.max(...rearHairWidths) - Math.min(...rearHairWidths);
  audit.acceptance.rearHairConsistency.passed =
    audit.acceptance.rearHairConsistency.maximumHeightDelta <= MAX_REAR_HAIR_HEIGHT_DELTA &&
    audit.acceptance.rearHairConsistency.maximumWidthDelta <= 1;
  await fs.writeFile(path.join(OUTPUT_ROOT, "audit.json"), `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify(audit.acceptance, null, 2));
  if (NEEDS_RIGHT_HAND_ACCESSORY_AUDIT && !audit.acceptance.rightHandAccessoryPlacement.passed) {
    throw new Error("오른손 가방 방향 감사에 실패했습니다.");
  }
  if (!audit.acceptance.rearHairConsistency.passed) {
    throw new Error("뒷머리 크기 일관성 감사에 실패했습니다.");
  }
  if (!audit.acceptance.headSizeConsistency.passed) {
    throw new Error("방향별 머리 크기 일관성 감사에 실패했습니다.");
  }
  if (!audit.acceptance.gaitCycle.passed) {
    throw new Error("보행 1·2·3컷 동작 감사에 실패했습니다.");
  }
  if (!audit.acceptance.threeHeadProportion.passed) {
    throw new Error("머리 1 + 몸 2 비율 감사에 실패했습니다.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
