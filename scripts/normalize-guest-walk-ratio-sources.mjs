#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const sourceRoot = process.argv[2] ?? 'character-assets/reference/guest-walk-direction-sources/v1';
const outRoot = process.argv[3] ?? 'character-assets/reference/guest-walk-ratio-sources/v2';
const reviewRoot = process.argv[4] ?? '.superpowers/character-review';

const CANVAS_W = 640;
const CANVAS_H = 1024;
const TARGET_TOTAL_H = 700;
const TARGET_HEAD_H = 200;
const TARGET_BODY_H = TARGET_TOTAL_H - TARGET_HEAD_H;
const TOP = Math.round((CANVAS_H - TARGET_TOTAL_H) / 2);
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

const guests = Array.from({ length: 12 }, (_, i) => `guest-${String(i + 1).padStart(2, '0')}`);
const directions = ['down', 'left', 'right', 'up'];
const steps = ['step-01', 'step-02', 'step-03'];

function isSubject(r, g, b, a) {
  if (a <= 10) return false;
  return !(r >= 246 && g >= 246 && b >= 246);
}

async function imageData(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function subjectBounds({ data, width, height }) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (isSubject(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (right < left || bottom < top) {
    throw new Error('subject bounds not found');
  }

  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

async function transparentExtract(file, rect) {
  const { data, info } = await sharp(file)
    .extract(rect)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] >= 246 && data[i + 1] >= 246 && data[i + 2] >= 246) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  }).png().toBuffer();
}

function splitHeadBody(bounds) {
  return Math.max(1, Math.min(bounds.height - 1, Math.round(bounds.height * 0.13)));
}

async function normalizeOne(input, output) {
  const data = await imageData(input);
  const bounds = subjectBounds(data);
  const split = splitHeadBody(bounds);

  const headRect = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: split,
  };
  const bodyRect = {
    left: bounds.left,
    top: bounds.top + split,
    width: bounds.width,
    height: bounds.height - split,
  };

  const headBuf = await transparentExtract(input, headRect);
  const bodyBuf = await transparentExtract(input, bodyRect);

  const resizedHead = await sharp(headBuf)
    .resize({ height: TARGET_HEAD_H })
    .png()
    .toBuffer({ resolveWithObject: true });

  const resizedBody = await sharp(bodyBuf)
    .resize({ width: bounds.width, height: TARGET_BODY_H, fit: 'fill' })
    .png()
    .toBuffer({ resolveWithObject: true });

  let headInput = resizedHead.data;
  let bodyInput = resizedBody.data;
  let headInfo = resizedHead.info;
  let bodyInfo = resizedBody.info;

  const maxContentW = Math.min(CANVAS_W - 96, Math.max(360, bounds.width));
  const composedW = Math.max(headInfo.width, bodyInfo.width);
  if (composedW > maxContentW) {
    const scale = maxContentW / composedW;
    const shrunkHead = await sharp(headInput)
      .resize({ width: Math.max(1, Math.round(headInfo.width * scale)), height: Math.max(1, Math.round(headInfo.height * scale)) })
      .png()
      .toBuffer({ resolveWithObject: true });
    const shrunkBody = await sharp(bodyInput)
      .resize({ width: Math.max(1, Math.round(bodyInfo.width * scale)), height: Math.max(1, Math.round(bodyInfo.height * scale)) })
      .png()
      .toBuffer({ resolveWithObject: true });
    headInput = shrunkHead.data;
    bodyInput = shrunkBody.data;
    headInfo = shrunkHead.info;
    bodyInfo = shrunkBody.info;
  }

  const centerX = Math.round(CANVAS_W / 2);
  const headTop = TOP;
  const bodyTop = TOP + headInfo.height;

  fs.mkdirSync(path.dirname(output), { recursive: true });
  await sharp({
    create: {
      width: CANVAS_W,
      height: CANVAS_H,
      channels: 4,
      background: BG,
    },
  })
    .composite([
      { input: headInput, left: centerX - Math.round(headInfo.width / 2), top: headTop },
      { input: bodyInput, left: centerX - Math.round(bodyInfo.width / 2), top: bodyTop },
    ])
    .png()
    .toFile(output);

  return {
    input,
    output,
    bounds,
    split,
    targetTotalHeight: headInfo.height + bodyInfo.height,
    targetHeadHeight: headInfo.height,
    targetBodyHeight: bodyInfo.height,
    targetRatio: Number((bodyInfo.height / headInfo.height).toFixed(3)),
  };
}

async function renderGuestReview(guest) {
  const cellW = 122;
  const cellH = 210;
  const gap = 14;
  const labelH = 22;
  const width = gap + steps.length * (cellW + gap);
  const height = gap + directions.length * (labelH + cellH + gap);
  const composites = [];

  for (let row = 0; row < directions.length; row += 1) {
    const direction = directions[row];
    const label = Buffer.from(`<svg width="${cellW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f8f8f8"/><text x="4" y="16" font-family="Arial" font-size="14" fill="#333">${direction}</text></svg>`);
    composites.push({ input: label, left: gap, top: gap + row * (labelH + cellH + gap) });
    for (let col = 0; col < steps.length; col += 1) {
      const step = steps[col];
      const file = path.join(outRoot, guest, direction, `${step}-source.png`);
      const input = await sharp(file)
        .resize({ width: cellW, height: cellH, fit: 'contain', background: 'white' })
        .png()
        .toBuffer();
      composites.push({
        input,
        left: gap + col * (cellW + gap),
        top: gap + row * (labelH + cellH + gap) + labelH,
      });
    }
  }

  fs.mkdirSync(reviewRoot, { recursive: true });
  const out = path.join(reviewRoot, `guest-walk-ratio-v2-${guest}.png`);
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 248, g: 248, b: 248, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(out);
  return out;
}

async function main() {
  const audit = [];
  for (const guest of guests) {
    for (const direction of directions) {
      for (const step of steps) {
        const input = path.join(sourceRoot, guest, direction, `${step}-source.png`);
        const output = path.join(outRoot, guest, direction, `${step}-source.png`);
        if (!fs.existsSync(input)) {
          throw new Error(`missing input: ${input}`);
        }
        audit.push(await normalizeOne(input, output));
      }
    }
    const review = await renderGuestReview(guest);
    console.log(JSON.stringify({ guest, review }));
  }

  fs.mkdirSync(outRoot, { recursive: true });
  const auditPath = path.join(outRoot, '_audit.json');
  fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify({ files: audit.length, auditPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
