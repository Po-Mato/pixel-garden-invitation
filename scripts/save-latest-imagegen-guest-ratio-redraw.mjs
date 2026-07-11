#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

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

  const guest = args.get("guest");
  const direction = args.get("direction");
  const step = args.get("step");
  const sourceRoot =
    args.get("source-root") ?? "character-assets/reference/guest-walk-ratio-redraw-sources/v1";
  const source = args.get("source");
  const targetHeight = Number(args.get("target-height") ?? "820");
  const baseline = Number(args.get("baseline") ?? "930");
  const canvasWidth = Number(args.get("width") ?? "640");
  const canvasHeight = Number(args.get("height") ?? "1024");
  const generatedRoot =
    args.get("generated-root") ??
    path.join(process.env.HOME ?? "", ".codex", "generated_images");

  if (!/^guest-\d{2}$/.test(guest ?? "")) {
    throw new Error("Missing or invalid --guest guest-XX");
  }
  if (!["down", "left", "right", "up"].includes(direction ?? "")) {
    throw new Error("Missing or invalid --direction down|left|right|up");
  }
  if (!/^step-\d{2}$/.test(step ?? "")) {
    throw new Error("Missing or invalid --step step-YY");
  }

  return {
    guest,
    direction,
    step,
    source,
    sourceRoot,
    generatedRoot,
    targetHeight,
    baseline,
    canvasWidth,
    canvasHeight,
  };
}

async function walkPngs(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkPngs(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".png")) {
      const stat = await fs.stat(fullPath);
      files.push({ path: fullPath, mtimeMs: stat.mtimeMs });
    }
  }
  return files;
}

async function newestGeneratedImage(generatedRoot) {
  const files = await walkPngs(generatedRoot);
  files.sort((left, right) => right.mtimeMs - left.mtimeMs);
  if (!files[0]) {
    throw new Error(`No generated PNG files found under ${generatedRoot}`);
  }
  return files[0].path;
}

function colorDistance(pixel, background) {
  return (
    Math.abs(pixel.r - background.r) +
    Math.abs(pixel.g - background.g) +
    Math.abs(pixel.b - background.b)
  );
}

function findForegroundBox({ data, width, height, channels }) {
  const sample = (x, y) => {
    const offset = (y * width + x) * channels;
    return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
  };
  const background = sample(0, 0);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const alpha = channels === 4 ? data[offset + 3] : 255;
      if (alpha < 16) {
        continue;
      }
      const pixel = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
      const darkEnough = pixel.r < 246 || pixel.g < 246 || pixel.b < 246;
      const differentFromBackground = colorDistance(pixel, background) > 24;
      if (!darkEnough && !differentFromBackground) {
        continue;
      }
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    throw new Error("Could not detect generated character foreground");
  }

  const pad = 10;
  return {
    left: Math.max(0, left - pad),
    top: Math.max(0, top - pad),
    width: Math.min(width - Math.max(0, left - pad), right - left + 1 + pad * 2),
    height: Math.min(height - Math.max(0, top - pad), bottom - top + 1 + pad * 2),
  };
}

async function normalizeGeneratedCharacter({
  source,
  out,
  canvasWidth,
  canvasHeight,
  targetHeight,
  baseline,
}) {
  const sourceImage = sharp(source).ensureAlpha();
  const { data, info } = await sourceImage
    .raw()
    .toBuffer({ resolveWithObject: true });
  const box = findForegroundBox({
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  });
  const scale = targetHeight / box.height;
  const targetWidth = Math.round(box.width * scale);
  const resizedHeight = Math.round(box.height * scale);
  const resized = await sharp(source)
    .extract(box)
    .resize({
      width: targetWidth,
      height: resizedHeight,
      fit: "fill",
    })
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

  return { box, scale, targetWidth, resizedHeight, left, top };
}

async function main() {
  const {
    guest,
    direction,
    step,
    sourceRoot,
    source: explicitSource,
    generatedRoot,
    targetHeight,
    baseline,
    canvasWidth,
    canvasHeight,
  } = parseArgs(process.argv.slice(2));
  const source = explicitSource ?? (await newestGeneratedImage(generatedRoot));
  const rawOut = path.join(sourceRoot, "_raw", guest, direction, `${step}-source.png`);
  const out = path.join(sourceRoot, guest, direction, `${step}-source.png`);

  await fs.mkdir(path.dirname(rawOut), { recursive: true });
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.copyFile(source, rawOut);

  const normalization = await normalizeGeneratedCharacter({
    source,
    out,
    canvasWidth,
    canvasHeight,
    targetHeight,
    baseline,
  });

  const metadata = await sharp(out).metadata();
  console.log(
    JSON.stringify(
      {
        source,
        rawOut,
        out,
        width: metadata.width,
        height: metadata.height,
        normalization,
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
