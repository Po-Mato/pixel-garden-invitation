#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(
  root,
  "character-assets/reference/guest-four-step-walk-sources/v1"
);
const rawLeftPassPath = path.join(
  sourceRoot,
  "raw/guest-03-left-forward-pass-imagegen.png"
);
const leftPassPath = path.join(sourceRoot, "guest-03-left-forward-pass.png");
const rightPassPath = path.join(sourceRoot, "guest-03-right-forward-pass.png");

function isConnectedCheckerPixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return Math.min(red, green, blue) >= 215
    && Math.max(red, green, blue) - Math.min(red, green, blue) <= 18;
}

async function removeConnectedCheckerboard(input) {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  const background = new Uint8Array(pixels);
  const queued = new Uint8Array(pixels);
  const queue = new Uint32Array(pixels);
  let head = 0;
  let tail = 0;
  const enqueue = (x, y) => {
    const pixel = y * info.width + x;
    if (queued[pixel]) return;
    queued[pixel] = 1;
    queue[tail] = pixel;
    tail += 1;
  };
  for (let x = 0; x < info.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, info.height - 1);
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    enqueue(0, y);
    enqueue(info.width - 1, y);
  }
  while (head < tail) {
    const pixel = queue[head];
    head += 1;
    const offset = pixel * info.channels;
    if (!isConnectedCheckerPixel(data, offset)) continue;
    background[pixel] = 1;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < info.width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < info.height) enqueue(x, y + 1);
  }

  const output = Buffer.alloc(pixels * 4);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const sourceOffset = pixel * info.channels;
    const targetOffset = pixel * 4;
    output[targetOffset] = data[sourceOffset];
    output[targetOffset + 1] = data[sourceOffset + 1];
    output[targetOffset + 2] = data[sourceOffset + 2];
    output[targetOffset + 3] = background[pixel] ? 0 : 255;
  }
  return sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .trim({ background: "#00000000", threshold: 2 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await mkdir(sourceRoot, { recursive: true });
const leftPass = await removeConnectedCheckerboard(rawLeftPassPath);
await sharp(leftPass).png({ compressionLevel: 9 }).toFile(leftPassPath);
await sharp(leftPass).flop().png({ compressionLevel: 9 }).toFile(rightPassPath);

console.log(`Prepared guest-03 opposite passing poses:\n${leftPassPath}\n${rightPassPath}`);
