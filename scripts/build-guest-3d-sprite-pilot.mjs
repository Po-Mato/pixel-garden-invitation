#!/usr/bin/env node

import fs from "node:fs/promises";
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
const DIRECTIONS = ["down", "left", "right", "up"];
const FRAME = { width: 96, height: 144 };
const SOURCE = { width: 640, height: 1024, foregroundHeight: 820, baseline: 930 };
const FOOT_BOTTOM = 132;
const CONTENT_HEIGHT = 127;
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

async function normalizeSource(frame) {
  const visible = await visibleFrame(frame);
  const scale = SOURCE.foregroundHeight / visible.height;
  const width = Math.min(SOURCE.width - 16, Math.max(1, Math.round(visible.width * scale)));
  const height = SOURCE.foregroundHeight;
  const resized = await sharp(visible.image)
    .resize({ width, height, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  return canvas(SOURCE.width, SOURCE.height, [
    {
      input: resized,
      left: Math.round((SOURCE.width - width) / 2),
      top: SOURCE.baseline - height + 1
    }
  ]);
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
  return canvas(metadata.width, metadata.height, [
    { input: upper, left: 0, top: 0 },
    { input: mirroredLower, left: 0, top: lowerTop }
  ]);
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
    composites.push({ input: labelSvg(`${direction} · 머리 1 + 몸 2 기준선`, frameWidth * 3 + gap * 2, labelHeight), left: margin, top: rowTop });
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
      const isHairColor =
        alpha > 80 &&
        red >= 18 && red < 145 &&
        green >= 8 && green < 105 &&
        blue < 90 &&
        red > green * 1.12 &&
        green > blue * 0.85;
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

  for (const direction of DIRECTIONS) {
    const splitFrames = await splitDirectionSheet(direction);
    framesByDirection[direction] = [];
    sourceFrames[direction] = [];
    audit.directions[direction] = [];

    for (let step = 0; step < splitFrames.length; step += 1) {
      const number = String(step + 1).padStart(2, "0");
      const source = await normalizeSource(splitFrames[step]);
      const soft = await normalizeGameFrame(splitFrames[step], "soft");
      const pixel = await normalizeGameFrame(splitFrames[step], "pixel");
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
    }
  };
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
