#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const directions = ["down", "left", "right", "up"];
const frameWidth = 384;
const frameHeight = 576;

function parseArgs(argv) {
  const rootIndex = argv.indexOf("--root");
  if (rootIndex === -1 || !argv[rootIndex + 1]) {
    throw new Error("Usage: node scripts/render-guest-3d-pose-guides.mjs --root <guest 3d root>");
  }
  return path.resolve(argv[rootIndex + 1]);
}

async function renderDirection(root, direction) {
  const output = path.join(root, "pose-guides", `${direction}-walk-pose-guide.png`);
  await mkdir(path.dirname(output), { recursive: true });
  const frames = [1, 2, 3].map((step, index) => ({
    input: path.join(root, "renders", direction, `step-${String(step).padStart(2, "0")}.png`),
    left: frameWidth * index,
    top: 0
  }));
  await sharp({
    create: {
      width: frameWidth * 3,
      height: frameHeight,
      channels: 4,
      background: "#e8ecea"
    }
  }).composite(frames).png().toFile(output);
  return output;
}

async function main() {
  const root = parseArgs(process.argv.slice(2));
  const guides = [];
  for (const direction of directions) guides.push(await renderDirection(root, direction));

  const contactSheet = path.join(root, "pose-guides", "guest-01-all-directions-pose-guide.png");
  await sharp({
    create: {
      width: frameWidth * 3,
      height: frameHeight * directions.length,
      channels: 4,
      background: "#e8ecea"
    }
  }).composite(guides.map((input, index) => ({ input, left: 0, top: frameHeight * index })))
    .png()
    .toFile(contactSheet);
  console.log(`3D 포즈 가이드 생성 완료: ${contactSheet}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
