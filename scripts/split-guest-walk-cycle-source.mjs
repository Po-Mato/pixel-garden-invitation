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
    args.get("out-root") ?? "character-assets/reference/guest-walk-direction-sources/v1";
  const reviewRoot =
    args.get("review-root") ?? ".superpowers/character-review";

  if (!input || !guest || !direction) {
    throw new Error(
      "Usage: node scripts/split-guest-walk-cycle-source.mjs --input <path> --guest guest-01 --direction down|left|right|up",
    );
  }

  if (!DIRECTIONS.has(direction)) {
    throw new Error(`Invalid direction: ${direction}`);
  }

  return { input, guest, direction, outRoot, reviewRoot };
}

function isForeground(r, g, b, a) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const darkness = 255 - min;
  const saturation = max - min;
  return a > 20 && (darkness > 12 || saturation > 10) && !(r > 246 && g > 246 && b > 246);
}

function collectForegroundPixels(data, width, height) {
  const pixels = [];
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + x * 4;
      if (
        isForeground(
          data[offset],
          data[offset + 1],
          data[offset + 2],
          data[offset + 3],
        )
      ) {
        pixels.push({ x, y });
      }
    }
  }
  return pixels;
}

function percentile(values, p) {
  if (values.length === 0) {
    throw new Error("Cannot calculate percentile for empty values");
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function clusterXs(xs, k = 3) {
  const sorted = xs.slice().sort((a, b) => a - b);
  let centers = [0.2, 0.5, 0.8].map((ratio) => sorted[Math.floor((sorted.length - 1) * ratio)]);

  for (let iteration = 0; iteration < 18; iteration += 1) {
    const groups = Array.from({ length: k }, () => []);
    for (const x of sorted) {
      let best = 0;
      let bestDistance = Infinity;
      for (let index = 0; index < k; index += 1) {
        const distance = Math.abs(x - centers[index]);
        if (distance < bestDistance) {
          best = index;
          bestDistance = distance;
        }
      }
      groups[best].push(x);
    }

    centers = groups.map((group, index) =>
      group.length === 0
        ? centers[index]
        : group.reduce((sum, value) => sum + value, 0) / group.length,
    );
  }

  return centers
    .map((center, index) => ({ center, index }))
    .sort((a, b) => a.center - b.center);
}

function calculateCrop({ pixels, center, panelWidth, width, height }) {
  const framePixels = pixels.filter((pixel) => Math.abs(pixel.x - center) <= panelWidth * 0.39);
  if (framePixels.length < 1000) {
    throw new Error(`Foreground cluster too small near x=${center}`);
  }

  const xs = framePixels.map((pixel) => pixel.x);
  const ys = framePixels.map((pixel) => pixel.y);
  const paddingX = Math.round(panelWidth * 0.07);
  const paddingTop = Math.round(height * 0.035);
  const paddingBottom = Math.round(height * 0.03);

  const left = Math.max(0, Math.floor(percentile(xs, 0.005) - paddingX));
  const right = Math.min(width - 1, Math.ceil(percentile(xs, 0.995) + paddingX));
  const top = Math.max(0, Math.floor(percentile(ys, 0.002) - paddingTop));
  const bottom = Math.min(height - 1, Math.ceil(percentile(ys, 0.998) + paddingBottom));

  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

async function makeReview({ frameFiles, reviewFile, panelWidth, panelHeight }) {
  const thumbWidth = Math.round(panelWidth * 0.33);
  const thumbHeight = Math.round(panelHeight * 0.33);
  const gap = 16;
  const padding = 16;
  const thumbs = await Promise.all(
    frameFiles.map((file) =>
      sharp(file)
        .resize({
          width: thumbWidth,
          height: thumbHeight,
          fit: "contain",
          background: "white",
        })
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
  const { input, guest, direction, outRoot, reviewRoot } = parseArgs(process.argv.slice(2));
  const outDir = path.join(outRoot, guest, direction);
  const reviewFile = path.join(reviewRoot, `guest-walk-cycle-v1-${guest}-${direction}.png`);
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(reviewRoot, { recursive: true });

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

  const panelWidth = Math.round(width / 3);
  const panelHeight = height;
  const orderedClusters = clusterXs(
    pixels.map((pixel) => pixel.x),
    3,
  );
  const frameFiles = [];

  for (let frameIndex = 0; frameIndex < 3; frameIndex += 1) {
    const crop = calculateCrop({
      pixels,
      center: orderedClusters[frameIndex].center,
      panelWidth,
      width,
      height,
    });
    const cropBuffer = await sharp(input).extract(crop).png().toBuffer();
    const left = Math.floor((panelWidth - crop.width) / 2);
    const top = Math.floor((panelHeight - crop.height) / 2);
    const frameFile = path.join(outDir, `step-${String(frameIndex + 1).padStart(2, "0")}-source.png`);

    await sharp({
      create: {
        width: panelWidth,
        height: panelHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{ input: cropBuffer, left, top }])
      .png()
      .toFile(frameFile);
    frameFiles.push(frameFile);
  }

  await makeReview({ frameFiles, reviewFile, panelWidth, panelHeight });

  console.log(
    JSON.stringify(
      {
        input,
        width,
        height,
        panelWidth,
        panelHeight,
        frameFiles,
        reviewFile,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
