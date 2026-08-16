#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import sharp from "sharp";

const directions = ["front", "left", "right", "back"];
const laneWidth = 384;
const canvasHeight = 576;
const crownY = 24;
const chinY = 192;
const footY = 528;
const contentHeight = footY - crownY;

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const next = argv[index + 1];
    args.set(value.slice(2), next);
    index += 1;
  }

  const source = args.get("source");
  const guest = args.get("guest");
  const outputRoot = args.get("output-root");
  const reviewStatus = args.get("review-status") ?? "pending-anatomical-chin-and-flatness-review";
  if (!source || !guest || !outputRoot) {
    throw new Error("Usage: build-flat-three-head-pilot --source image.png --guest guest-XX --output-root dir");
  }
  if (!new Set(["pending-anatomical-chin-and-flatness-review", "passed"]).has(reviewStatus)) {
    throw new Error("--review-status must be pending-anatomical-chin-and-flatness-review or passed");
  }
  return { source: resolve(source), guest, outputRoot: resolve(outputRoot), reviewStatus };
}

function canBeConnectedBackground(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  return alpha === 0 || (minimum >= 210 && maximum - minimum <= 14);
}

function clearConnectedBackground(data, width, height) {
  const queued = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pixel = y * width + x;
    if (queued[pixel] || !canBeConnectedBackground(data, pixel * 4)) return;
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

function alphaBounds(data, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (data[pixel * 4 + 3] < 16) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top) throw new Error("No character foreground found");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function extractDirection(source, sourceWidth, sourceHeight, index) {
  const sourceLeft = Math.round((sourceWidth * index) / directions.length);
  const sourceRight = Math.round((sourceWidth * (index + 1)) / directions.length);
  const { data, info } = await sharp(source)
    .extract({ left: sourceLeft, top: 0, width: sourceRight - sourceLeft, height: sourceHeight })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  clearConnectedBackground(data, info.width, info.height);
  const bounds = alphaBounds(data, info.width, info.height);
  const cropped = await sharp(data, { raw: info }).extract(bounds).png().toBuffer();
  const scale = contentHeight / bounds.height;
  const width = Math.round(bounds.width * scale);
  const normalized = await sharp(cropped)
    .resize({ width, height: contentHeight, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  return {
    direction: directions[index],
    normalized,
    sourceBounds: bounds,
    normalizedBounds: { left: Math.round((laneWidth - width) / 2), top: crownY, width, height: contentHeight },
  };
}

function guideSvg(width, height) {
  const labels = [
    [crownY, "CROWN 0"],
    [chinY, "CHIN 1H"],
    [footY, "FOOT 3H"],
  ];
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${labels.map(([y, label], index) => `
        <path d="M0 ${y}H${width}" stroke="${["#2477ff", "#e04469", "#1c9a65"][index]}" stroke-width="3" stroke-dasharray="10 8"/>
        <text x="12" y="${y - 7}" fill="${["#2477ff", "#e04469", "#1c9a65"][index]}" font-family="Arial" font-size="18" font-weight="700">${label}</text>
      `).join("")}
      ${directions.map((direction, index) => `
        <path d="M${index * laneWidth} 0V${height}" stroke="#d8d3cc" stroke-width="2"/>
        <text x="${index * laneWidth + laneWidth / 2}" y="568" text-anchor="middle" fill="#514b45" font-family="Arial" font-size="18" font-weight="700">${direction.toUpperCase()}</text>
      `).join("")}
    </svg>
  `);
}

async function main() {
  const { source, guest, outputRoot, reviewStatus } = parseArgs(process.argv.slice(2));
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Source dimensions are unavailable");
  const views = await Promise.all(
    directions.map((_, index) => extractDirection(source, metadata.width, metadata.height, index)),
  );

  await mkdir(outputRoot, { recursive: true });
  const sheetWidth = laneWidth * directions.length;
  const composites = views.map(({ normalized, normalizedBounds }, index) => ({
    input: normalized,
    left: index * laneWidth + normalizedBounds.left,
    top: normalizedBounds.top,
  }));
  const pilotPath = join(outputRoot, `${guest}-turnaround-pilot.png`);
  const pilot = await sharp({
    create: { width: sheetWidth, height: canvasHeight, channels: 4, background: "#00000000" },
  })
    .composite(composites)
    .png({ palette: true, colours: 40, dither: 0, compressionLevel: 9 })
    .toBuffer();
  await writeFile(pilotPath, pilot);

  const auditPath = join(outputRoot, `${guest}-ratio-audit.png`);
  await sharp({
    create: { width: sheetWidth, height: canvasHeight, channels: 4, background: "#f7f3ed" },
  })
    .composite([
      { input: pilot, left: 0, top: 0 },
      { input: guideSvg(sheetWidth, canvasHeight), left: 0, top: 0 },
    ])
    .png({ palette: true, colours: 64, dither: 0, compressionLevel: 9 })
    .toFile(auditPath);

  const audit = {
    guest,
    source: basename(source),
    dimensions: { width: sheetWidth, height: canvasHeight, laneWidth },
    exactThreeHeadRig: {
      headBoundary: "crown-to-neck-junction; the shared proxy for the hidden rear-view chin",
      crownY,
      chinY,
      footY,
      headHeight: chinY - crownY,
      bodyBelowChinHeight: footY - chinY,
      totalCharacterHeight: contentHeight,
      targetRatio: "1:2",
    },
    normalization: "whole-character uniform scale only; no head/body or directional stretch",
    flatColorPolicy: {
      style: "flat 2D game character",
      maximumPaletteColors: 40,
      dither: 0,
      forbidden: ["volumetric lighting", "gradient shading", "gloss", "cast shadow", "3D perspective"],
    },
    directions: views.map(({ direction, sourceBounds, normalizedBounds }) => ({
      direction,
      sourceBounds,
      normalizedBounds,
      crownY,
      targetChinY: chinY,
      footY,
    })),
    acceptance: {
      ratio: reviewStatus === "passed",
      fourDirectionLandmarks: reviewStatus === "passed",
      flatness: reviewStatus === "passed",
      transparentBackground: true,
    },
    reviewStatus,
  };
  const auditJsonPath = join(outputRoot, `${guest}-audit.json`);
  await writeFile(auditJsonPath, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify({ pilotPath, auditPath, auditJsonPath, audit }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
