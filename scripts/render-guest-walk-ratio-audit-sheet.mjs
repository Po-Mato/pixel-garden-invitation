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
    args.get("source-root") ?? "character-assets/reference/guest-walk-ratio-redraw-sources/v2";
  const out =
    args.get("out") ?? `.superpowers/character-review/guest-walk-ratio-redraw-v2-${guest}-ratio-audit.png`;
  const scale = Number(args.get("scale") ?? "0.28");
  const foregroundTop = Number(args.get("foreground-top") ?? "110");
  const foregroundHeight = Number(args.get("foreground-height") ?? "820");
  const baseline = Number(args.get("baseline") ?? "930");

  if (!/^guest-\d{2}$/.test(guest ?? "")) {
    throw new Error("Usage: node scripts/render-guest-walk-ratio-audit-sheet.mjs --guest guest-01");
  }

  return { guest, sourceRoot, out, scale, foregroundTop, foregroundHeight, baseline };
}

function guideSvg({ width, height, scale, foregroundTop, foregroundHeight, baseline }) {
  const top = foregroundTop * scale;
  const head = (foregroundTop + foregroundHeight / 3) * scale;
  const bodyTwo = (foregroundTop + (foregroundHeight * 2) / 3) * scale;
  const base = baseline * scale;

  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="${top}" x2="${width}" y2="${top}" stroke="#3b82f6" stroke-width="1.2" opacity="0.75"/>
    <line x1="0" y1="${head}" x2="${width}" y2="${head}" stroke="#ef4444" stroke-width="1.5" opacity="0.9"/>
    <line x1="0" y1="${bodyTwo}" x2="${width}" y2="${bodyTwo}" stroke="#f59e0b" stroke-width="1.2" opacity="0.75"/>
    <line x1="0" y1="${base}" x2="${width}" y2="${base}" stroke="#22c55e" stroke-width="1.2" opacity="0.75"/>
  </svg>`);
}

async function main() {
  const { guest, sourceRoot, out, scale, foregroundTop, foregroundHeight, baseline } = parseArgs(
    process.argv.slice(2),
  );
  const frameWidth = Math.round(640 * scale);
  const frameHeight = Math.round(1024 * scale);
  const gap = 10;
  const padding = 16;
  const labelHeight = 24;
  const rowHeight = labelHeight + frameHeight + gap;
  const sheetWidth = padding * 2 + frameWidth * 3 + gap * 2;
  const sheetHeight = padding * 2 + rowHeight * DIRECTIONS.length - gap;
  const guide = guideSvg({
    width: frameWidth,
    height: frameHeight,
    scale,
    foregroundTop,
    foregroundHeight,
    baseline,
  });

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
        .resize({ width: frameWidth, height: frameHeight, fit: "contain", background: "white" })
        .composite([{ input: guide, left: 0, top: 0 }])
        .png()
        .toBuffer();
      composites.push({
        input,
        left: padding + (step - 1) * (frameWidth + gap),
        top: padding + row * rowHeight + labelHeight,
      });
    }
  }

  await fs.mkdir(path.dirname(out), { recursive: true });
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 248, g: 248, b: 248, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(out);

  console.log(JSON.stringify({ out, guest, width: sheetWidth, height: sheetHeight }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
