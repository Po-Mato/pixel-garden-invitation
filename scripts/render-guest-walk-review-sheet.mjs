#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const DIRECTIONS = ["down", "left", "right", "up"];

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
  const sourceRoot =
    args.get("source-root") ?? "character-assets/reference/guest-walk-direction-sources/v1";
  const out =
    args.get("out") ?? `.superpowers/character-review/guest-walk-v1-${guest ?? "all"}.png`;
  const scale = Number(args.get("scale") ?? "0.18");

  if (!guest && !args.get("all")) {
    throw new Error(
      "Usage: node scripts/render-guest-walk-review-sheet.mjs --guest guest-01 OR --all",
    );
  }

  return { guest, sourceRoot, out, scale, all: Boolean(args.get("all")) };
}

async function existingGuests(sourceRoot) {
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^guest-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function metadata(file) {
  const data = await sharp(file).metadata();
  if (!data.width || !data.height) {
    throw new Error(`Cannot read image size: ${file}`);
  }
  return data;
}

async function renderGuest({ guest, sourceRoot, scale }) {
  const firstFile = path.join(sourceRoot, guest, "down", "step-01-source.png");
  const { width, height } = await metadata(firstFile);
  const thumbWidth = Math.round(width * scale);
  const thumbHeight = Math.round(height * scale);
  const labelHeight = 28;
  const padding = 16;
  const gap = 10;
  const rowHeight = thumbHeight + labelHeight + gap;
  const sheetWidth = padding * 2 + thumbWidth * 3 + gap * 2;
  const sheetHeight = padding * 2 + DIRECTIONS.length * rowHeight - gap;

  const composites = [];
  for (let row = 0; row < DIRECTIONS.length; row += 1) {
    const direction = DIRECTIONS[row];
    for (let step = 1; step <= 3; step += 1) {
      const file = path.join(
        sourceRoot,
        guest,
        direction,
        `step-${String(step).padStart(2, "0")}-source.png`,
      );
      const input = await sharp(file)
        .resize({
          width: thumbWidth,
          height: thumbHeight,
          fit: "contain",
          background: "white",
        })
        .png()
        .toBuffer();
      composites.push({
        input,
        left: padding + (step - 1) * (thumbWidth + gap),
        top: padding + row * rowHeight + labelHeight,
      });
    }
  }

  const base = sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 248, g: 248, b: 248, alpha: 1 },
    },
  }).composite(composites);

  return {
    input: await base.png().toBuffer(),
    width: sheetWidth,
    height: sheetHeight,
  };
}

async function main() {
  const { guest, sourceRoot, out, scale, all } = parseArgs(process.argv.slice(2));
  await fs.mkdir(path.dirname(out), { recursive: true });
  const guests = all ? await existingGuests(sourceRoot) : [guest];

  if (guests.length === 1) {
    const rendered = await renderGuest({ guest: guests[0], sourceRoot, scale });
    await sharp(rendered.input).png().toFile(out);
    console.log(JSON.stringify({ out, guests, width: rendered.width, height: rendered.height }, null, 2));
    return;
  }

  const renderedGuests = await Promise.all(
    guests.map((item) => renderGuest({ guest: item, sourceRoot, scale: scale * 0.82 })),
  );
  const gap = 16;
  const columns = 4;
  const width = Math.max(...renderedGuests.map((item) => item.width));
  const height = Math.max(...renderedGuests.map((item) => item.height));
  const sheetWidth = columns * width + (columns + 1) * gap;
  const rows = Math.ceil(renderedGuests.length / columns);
  const sheetHeight = rows * height + (rows + 1) * gap;
  const composites = renderedGuests.map((item, index) => ({
    input: item.input,
    left: gap + (index % columns) * (width + gap),
    top: gap + Math.floor(index / columns) * (height + gap),
  }));

  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 240, g: 240, b: 240, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(out);

  console.log(JSON.stringify({ out, guests, width: sheetWidth, height: sheetHeight }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
