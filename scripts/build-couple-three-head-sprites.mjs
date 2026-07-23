#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = join(root, "character-assets/reference/couple-three-head-redraw-sources/v1");
const sheetRoot = join(referenceRoot, "_sheets");
const frameRoot = join(referenceRoot, "frames");
const sourceRoot = join(root, "character-assets/source/npc");
const reviewRoot = join(root, ".superpowers/character-review");

export const coupleThreeHeadLayout = {
  frameWidth: 96,
  frameHeight: 144,
  contentTop: 7,
  headHeight: 42,
  bodyHeight: 84,
  contentBottom: 132
};

export const coupleThreeHeadSplitY = {
  bride: { down: 327, left: 318, right: 314, up: 376 },
  groom: { down: 372, left: 379, right: 376, up: 378 }
};

const characters = ["bride", "groom"];
const directions = ["down", "left", "right", "up"];

function alphaBounds(data, imageWidth, region) {
  let left = region.left + region.width;
  let top = region.top + region.height;
  let right = -1;
  let bottom = -1;
  const endX = region.left + region.width;
  const endY = region.top + region.height;

  for (let y = region.top; y < endY; y += 1) {
    for (let x = region.left; x < endX; x += 1) {
      if (data[(y * imageWidth + x) * 4 + 3] <= 24) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) throw new Error("Opaque sprite pixels were not found");
  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1
  };
}

function clampWidth(value) {
  return Math.max(1, Math.min(92, Math.round(value)));
}

async function keepLargestAlphaComponent(image) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visited = new Uint8Array(info.width * info.height);
  const components = [];

  for (let pixel = 0; pixel < visited.length; pixel += 1) {
    if (visited[pixel] || data[pixel * 4 + 3] <= 24) continue;
    const component = [pixel];
    visited[pixel] = 1;
    for (let index = 0; index < component.length; index += 1) {
      const current = component[index];
      const x = current % info.width;
      const y = Math.floor(current / info.width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= info.width || nextY < 0 || nextY >= info.height) continue;
          const next = nextY * info.width + nextX;
          if (visited[next] || data[next * 4 + 3] <= 24) continue;
          visited[next] = 1;
          component.push(next);
        }
      }
    }
    components.push(component);
  }

  components.sort((left, right) => right.length - left.length);
  for (const component of components.slice(1)) {
    for (const pixel of component) data[pixel * 4 + 3] = 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function buildFrame(sheet, metadata, character, direction, column) {
  const { frameWidth, frameHeight, contentTop, headHeight, bodyHeight } = coupleThreeHeadLayout;
  const cellLeft = Math.floor((column * metadata.width) / 3);
  const cellRight = Math.floor(((column + 1) * metadata.width) / 3);
  const splitY = coupleThreeHeadSplitY[character][direction];
  const headRegion = { left: cellLeft, top: 0, width: cellRight - cellLeft, height: splitY };
  const bodyRegion = {
    left: cellLeft,
    top: splitY,
    width: cellRight - cellLeft,
    height: metadata.height - splitY
  };
  const headBounds = alphaBounds(metadata.data, metadata.width, headRegion);
  const bodyBounds = alphaBounds(metadata.data, metadata.width, bodyRegion);
  const horizontalScale = headHeight / headBounds.height;
  const headWidth = clampWidth(headBounds.width * horizontalScale);
  const bodyWidth = clampWidth(bodyBounds.width * horizontalScale);
  const sourceCenter = (cellLeft + cellRight) / 2;
  const headCenter = frameWidth / 2 + (headBounds.left + headBounds.width / 2 - sourceCenter) * horizontalScale;
  const bodyCenter = frameWidth / 2 + (bodyBounds.left + bodyBounds.width / 2 - sourceCenter) * horizontalScale;
  let headLeft = Math.round(headCenter - headWidth / 2);
  let bodyLeft = Math.round(bodyCenter - bodyWidth / 2);
  const minLeft = Math.min(headLeft, bodyLeft);
  const maxRight = Math.max(headLeft + headWidth, bodyLeft + bodyWidth);
  let shift = minLeft < 2 ? 2 - minLeft : 0;
  if (maxRight + shift > frameWidth - 2) shift -= maxRight + shift - (frameWidth - 2);
  headLeft += shift;
  bodyLeft += shift;

  const head = await sharp(sheet)
    .extract(headBounds)
    .resize(headWidth, headHeight, { fit: "fill", kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
  const body = await sharp(sheet)
    .extract(bodyBounds)
    .resize(bodyWidth, bodyHeight, { fit: "fill", kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
  const composedFrame = await sharp({
    create: {
      width: frameWidth,
      height: frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: head, left: headLeft, top: contentTop },
      { input: body, left: bodyLeft, top: contentTop + headHeight }
    ])
    .png()
    .toBuffer();
  const frame = await keepLargestAlphaComponent(composedFrame);

  return {
    frame,
    audit: {
      character,
      direction,
      step: column + 1,
      sourceHeadHeight: headBounds.height,
      sourceBodyHeight: bodyBounds.height,
      targetHeadHeight: headHeight,
      targetBodyHeight: bodyHeight,
      bodyToHeadRatio: bodyHeight / headHeight,
      contentTop,
      contentBottom: contentTop + headHeight + bodyHeight - 1
    }
  };
}

function labelSvg(text, width, height) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#f7f4ef"/>
    <text x="8" y="18" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#453b39">${text}</text>
  </svg>`);
}

function guideSvg(width, height, scale) {
  const top = coupleThreeHeadLayout.contentTop * scale;
  const chin = (coupleThreeHeadLayout.contentTop + coupleThreeHeadLayout.headHeight) * scale;
  const bottom = (coupleThreeHeadLayout.contentBottom + 1) * scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <path d="M0 ${top}H${width}" stroke="#3d7ddd" stroke-width="2"/>
    <path d="M0 ${chin}H${width}" stroke="#dc596b" stroke-width="2"/>
    <path d="M0 ${bottom}H${width}" stroke="#3d7ddd" stroke-width="2"/>
  </svg>`);
}

async function writeRatioAudit(character, frames) {
  const scale = 2;
  const cellWidth = coupleThreeHeadLayout.frameWidth * scale;
  const cellHeight = coupleThreeHeadLayout.frameHeight * scale;
  const labelHeight = 24;
  const gap = 12;
  const width = gap + 3 * (cellWidth + gap);
  const height = gap + 4 * (labelHeight + cellHeight + gap);
  const composites = [];
  const guides = guideSvg(cellWidth, cellHeight, scale);

  for (let row = 0; row < directions.length; row += 1) {
    const direction = directions[row];
    const rowTop = gap + row * (labelHeight + cellHeight + gap);
    composites.push({ input: labelSvg(`${character} / ${direction}`, cellWidth, labelHeight), left: gap, top: rowTop });
    for (let column = 0; column < 3; column += 1) {
      const cellLeft = gap + column * (cellWidth + gap);
      const cellTop = rowTop + labelHeight;
      const enlarged = await sharp(frames[direction][column])
        .resize(cellWidth, cellHeight, { kernel: sharp.kernel.nearest })
        .png()
        .toBuffer();
      composites.push({ input: enlarged, left: cellLeft, top: cellTop });
      composites.push({ input: guides, left: cellLeft, top: cellTop });
    }
  }

  await mkdir(reviewRoot, { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: { r: 239, g: 235, b: 229, alpha: 1 } }
  })
    .composite(composites)
    .png()
    .toFile(join(reviewRoot, `couple-three-head-${character}-ratio-audit.png`));
}

export async function buildCoupleThreeHeadSprites() {
  const audit = [];

  for (const character of characters) {
    const frames = {};
    for (const direction of directions) {
      const sheetPath = join(sheetRoot, `${character}-${direction}.png`);
      const sheet = await readFile(sheetPath);
      const { data, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      frames[direction] = [];
      for (let column = 0; column < 3; column += 1) {
        const result = await buildFrame(sheet, { data, width: info.width, height: info.height }, character, direction, column);
        frames[direction].push(result.frame);
        audit.push(result.audit);
        const framePath = join(frameRoot, character, direction, `step-${String(column + 1).padStart(2, "0")}.png`);
        await mkdir(dirname(framePath), { recursive: true });
        await writeFile(framePath, result.frame);
      }
    }

    const walkComposites = [];
    for (let row = 0; row < directions.length; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        walkComposites.push({
          input: frames[directions[row]][column],
          left: column * coupleThreeHeadLayout.frameWidth,
          top: row * coupleThreeHeadLayout.frameHeight
        });
      }
    }
    const walk = await sharp({
      create: { width: 288, height: 576, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).composite(walkComposites).png().toBuffer();
    const neutral = frames.down[1];
    const idle = await sharp({
      create: { width: 192, height: 144, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).composite([{ input: neutral, left: 0, top: 0 }, { input: neutral, left: 96, top: 0 }]).png().toBuffer();
    await writeFile(join(sourceRoot, `${character}-walk.png`), walk);
    await writeFile(join(sourceRoot, `${character}-idle.png`), idle);
    await writeRatioAudit(character, frames);
  }

  const auditPath = join(referenceRoot, "ratio-audit.json");
  await writeFile(auditPath, `${JSON.stringify({ layout: coupleThreeHeadLayout, frames: audit }, null, 2)}\n`);
  return { auditPath, frames: audit.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildCoupleThreeHeadSprites();
  console.log(`Built ${result.frames} couple frames with a 1:2 head-to-body ratio`);
}
