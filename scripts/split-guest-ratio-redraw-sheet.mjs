#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const DIRECTIONS = new Set(["down", "left", "right", "up"]);

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    index += 1;
  }

  const input = args.get("input");
  const guest = args.get("guest");
  const direction = args.get("direction");
  const outRoot =
    args.get("out-root") ?? "character-assets/reference/guest-walk-ratio-redraw-sources/v1";
  const reviewRoot = args.get("review-root") ?? ".superpowers/character-review";
  const targetHeight = Number(args.get("target-height") ?? "820");
  const baseline = Number(args.get("baseline") ?? "930");
  const canvasWidth = Number(args.get("width") ?? "640");
  const canvasHeight = Number(args.get("height") ?? "1024");

  if (!input || !/^guest-\d{2}$/.test(guest ?? "") || !DIRECTIONS.has(direction ?? "")) {
    throw new Error(
      "Usage: node scripts/split-guest-ratio-redraw-sheet.mjs --input <path> --guest guest-01 --direction down|left|right|up",
    );
  }

  return {
    input,
    guest,
    direction,
    outRoot,
    reviewRoot,
    targetHeight,
    baseline,
    canvasWidth,
    canvasHeight,
  };
}

function isForeground(r, g, b, a) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const darkness = 255 - min;
  const saturation = max - min;
  return a > 20 && (darkness > 12 || saturation > 10) && !(r > 247 && g > 247 && b > 247);
}

function collectForegroundPixels(data, width, height) {
  const pixels = [];
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + x * 4;
      if (isForeground(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) {
        pixels.push({ x, y });
      }
    }
  }
  return pixels;
}

function percentile(values, p) {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function clusterXs(xs, k = 3) {
  const sorted = xs.slice().sort((a, b) => a - b);
  let centers = [0.18, 0.5, 0.82].map((ratio) => sorted[Math.floor((sorted.length - 1) * ratio)]);

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const groups = Array.from({ length: k }, () => []);
    for (const x of sorted) {
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let index = 0; index < centers.length; index += 1) {
        const distance = Math.abs(x - centers[index]);
        if (distance < bestDistance) {
          bestIndex = index;
          bestDistance = distance;
        }
      }
      groups[bestIndex].push(x);
    }
    centers = groups.map((group, index) =>
      group.length > 0 ? group.reduce((sum, value) => sum + value, 0) / group.length : centers[index],
    );
  }

  return centers.slice().sort((a, b) => a - b);
}

function calculateCrop({ pixels, center, panelWidth, width, height }) {
  const framePixels = pixels.filter((pixel) => Math.abs(pixel.x - center) <= panelWidth * 0.42);
  if (framePixels.length < 1000) {
    throw new Error(`Foreground cluster too small near x=${center}`);
  }

  const xs = framePixels.map((pixel) => pixel.x);
  const ys = framePixels.map((pixel) => pixel.y);
  const left = Math.max(0, Math.floor(percentile(xs, 0.003) - panelWidth * 0.06));
  const right = Math.min(width - 1, Math.ceil(percentile(xs, 0.997) + panelWidth * 0.06));
  const top = Math.max(0, Math.floor(percentile(ys, 0.002) - height * 0.025));
  const bottom = Math.min(height - 1, Math.ceil(percentile(ys, 0.998) + height * 0.025));

  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

async function renderFrame({ input, crop, out, targetHeight, baseline, canvasWidth, canvasHeight }) {
  const scale = targetHeight / crop.height;
  const targetWidth = Math.round(crop.width * scale);
  const resizedHeight = Math.round(crop.height * scale);
  const resized = await sharp(input)
    .extract(crop)
    .resize({ width: targetWidth, height: resizedHeight, fit: "fill" })
    .png()
    .toBuffer();
  const left = Math.round((canvasWidth - targetWidth) / 2);
  const top = Math.round(baseline - resizedHeight);

  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(out);

  return { crop, scale, targetWidth, resizedHeight, left, top };
}

async function makeReview({ frameFiles, reviewFile }) {
  const thumbWidth = 220;
  const thumbHeight = 352;
  const gap = 16;
  const padding = 16;
  const thumbs = await Promise.all(
    frameFiles.map((file) =>
      sharp(file)
        .resize({ width: thumbWidth, height: thumbHeight, fit: "contain", background: "white" })
        .png()
        .toBuffer(),
    ),
  );

  await sharp({
    create: {
      width: thumbWidth * 3 + gap * 2 + padding * 2,
      height: thumbHeight + padding * 2,
      channels: 4,
      background: { r: 248, g: 248, b: 248, alpha: 1 },
    },
  })
    .composite(thumbs.map((input, index) => ({ input, left: padding + index * (thumbWidth + gap), top: padding })))
    .png()
    .toFile(reviewFile);
}

async function main() {
  const {
    input,
    guest,
    direction,
    outRoot,
    reviewRoot,
    targetHeight,
    baseline,
    canvasWidth,
    canvasHeight,
  } = parseArgs(process.argv.slice(2));

  const outDir = path.join(outRoot, guest, direction);
  const sheetOut = path.join(outRoot, "_sheets", guest, `${direction}-walk-cycle-source.png`);
  const reviewFile = path.join(reviewRoot, `guest-walk-ratio-redraw-v1-${guest}-${direction}.png`);
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.dirname(sheetOut), { recursive: true });
  await fs.mkdir(reviewRoot, { recursive: true });
  await fs.copyFile(input, sheetOut);

  const source = sharp(input).ensureAlpha();
  const { width, height } = await source.metadata();
  if (!width || !height) {
    throw new Error(`Cannot read image size: ${input}`);
  }
  const raw = await source.raw().toBuffer();
  const pixels = collectForegroundPixels(raw, width, height);
  if (pixels.length < 1000) {
    throw new Error(`Foreground detection failed: ${input}`);
  }

  const panelWidth = width / 3;
  const centers = clusterXs(pixels.map((pixel) => pixel.x));
  const frameFiles = [];
  const normalizations = [];
  for (let index = 0; index < 3; index += 1) {
    const crop = calculateCrop({ pixels, center: centers[index], panelWidth, width, height });
    const frameFile = path.join(outDir, `step-${String(index + 1).padStart(2, "0")}-source.png`);
    const normalization = await renderFrame({
      input,
      crop,
      out: frameFile,
      targetHeight,
      baseline,
      canvasWidth,
      canvasHeight,
    });
    frameFiles.push(frameFile);
    normalizations.push(normalization);
  }

  await makeReview({ frameFiles, reviewFile });

  console.log(
    JSON.stringify(
      { input, sheetOut, width, height, centers, frameFiles, reviewFile, normalizations },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
