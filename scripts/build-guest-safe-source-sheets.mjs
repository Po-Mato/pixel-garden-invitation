#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const catalogPath = path.join(root, "character-assets/guest-character-presets.json");
const defaultInputRoot = path.join(
  root,
  "character-assets/reference/guest-unified-rig-sources/v9"
);
const defaultOutputRoot = path.join(
  root,
  "character-assets/reference/guest-unified-rig-sources/v10"
);
const defaultAlphaMaskRoot = path.join(
  root,
  "character-assets/reference/guest-alpha-masks/v1"
);

const SHEET_WIDTH = 1086;
const SHEET_HEIGHT = 1448;
const CELL_WIDTH = SHEET_WIDTH / 3;
const CELL_HEIGHT = SHEET_HEIGHT / 4;
const MINIMUM_TRANSPARENT_PERCENTAGE = 60;

function clearSheetBorder(data, width, height) {
  const clear = (x, y) => {
    const offset = (y * width + x) * 4;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
  };
  for (let x = 0; x < width; x += 1) {
    clear(x, 0);
    clear(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    clear(0, y);
    clear(width - 1, y);
  }
}

function decontaminateTransparentEdges(data, width, height) {
  const pixelCount = width * height;
  const distance = new Uint8Array(pixelCount);
  distance.fill(255);
  const source = new Int32Array(pixelCount);
  source.fill(-1);
  const queue = new Uint32Array(pixelCount);
  let head = 0;
  let tail = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const alpha = data[pixel * 4 + 3];
    if (alpha >= 245) {
      distance[pixel] = 0;
      source[pixel] = pixel;
      queue[tail] = pixel;
      tail += 1;
    } else if (alpha === 0) {
      data[pixel * 4] = 0;
      data[pixel * 4 + 1] = 0;
      data[pixel * 4 + 2] = 0;
    }
  }
  const visit = (from, pixel) => {
    if (pixel < 0 || pixel >= pixelCount) return;
    if (data[pixel * 4 + 3] === 0 || distance[pixel] !== 255) return;
    distance[pixel] = distance[from] + 1;
    source[pixel] = source[from];
    queue[tail] = pixel;
    tail += 1;
  };
  while (head < tail) {
    const pixel = queue[head];
    head += 1;
    if (distance[pixel] >= 6) continue;
    const x = pixel % width;
    if (x > 0) visit(pixel, pixel - 1);
    if (x < width - 1) visit(pixel, pixel + 1);
    if (pixel >= width) visit(pixel, pixel - width);
    if (pixel < pixelCount - width) visit(pixel, pixel + width);
  }
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const alpha = data[pixel * 4 + 3];
    const nearest = source[pixel];
    if (alpha === 0 || alpha >= 245 || nearest < 0 || distance[pixel] > 6) continue;
    const offset = pixel * 4;
    const nearestOffset = nearest * 4;
    data[offset] = data[nearestOffset];
    data[offset + 1] = data[nearestOffset + 1];
    data[offset + 2] = data[nearestOffset + 2];
  }
}

function alphaMetrics(data, width, height) {
  let transparentPixels = 0;
  let partialPixels = 0;
  let borderOpaquePixels = 0;
  let borderPixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 8) transparentPixels += 1;
      else if (alpha < 247) partialPixels += 1;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        borderPixels += 1;
        if (alpha > 8) borderOpaquePixels += 1;
      }
    }
  }
  const pixelCount = width * height;
  return {
    transparentPercentage: transparentPixels / pixelCount * 100,
    partialPercentage: partialPixels / pixelCount * 100,
    borderOpaquePercentage: borderOpaquePixels / borderPixels * 100
  };
}

async function makeSafeAlphaSheet(input, mask) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== SHEET_WIDTH || info.height !== SHEET_HEIGHT) {
    throw new Error(`${input} 시트 크기는 ${SHEET_WIDTH}x${SHEET_HEIGHT}여야 합니다.`);
  }
  const before = alphaMetrics(data, info.width, info.height);
  const hadRealAlpha = before.transparentPercentage >= MINIMUM_TRANSPARENT_PERCENTAGE;
  if (!hadRealAlpha) {
    await access(mask);
    const { data: alpha, info: maskInfo } = await sharp(mask)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (maskInfo.width !== info.width || maskInfo.height !== info.height) {
      throw new Error(`${mask} 알파 마스크 크기가 원본과 일치하지 않습니다.`);
    }
    for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
      data[pixel * 4 + 3] = alpha[pixel * maskInfo.channels];
    }
    decontaminateTransparentEdges(data, info.width, info.height);
  }
  clearSheetBorder(data, info.width, info.height);
  const after = alphaMetrics(data, info.width, info.height);
  if (
    after.transparentPercentage < MINIMUM_TRANSPARENT_PERCENTAGE
    || after.borderOpaquePercentage !== 0
  ) {
    throw new Error(
      `${input} 실제 투명 배경 추출 실패: transparent=${after.transparentPercentage.toFixed(2)}%, `
      + `border=${after.borderOpaquePercentage.toFixed(2)}%`
    );
  }
  const cleaned = await sharp(data, { raw: info })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { cleaned, before, after, hadRealAlpha, maskApplied: !hadRealAlpha };
}

async function loadGrid(sheet) {
  const { data, info } = await sharp(sheet)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const findValleyBoundaries = (axis, count) => {
    const length = axis === "x" ? info.width : info.height;
    const crossLength = axis === "x" ? info.height : info.width;
    const counts = new Uint32Array(length);
    for (let position = 0; position < length; position += 1) {
      for (let cross = 0; cross < crossLength; cross += 1) {
        const x = axis === "x" ? position : cross;
        const y = axis === "x" ? cross : position;
        if (data[(y * info.width + x) * 4 + 3] >= 8) counts[position] += 1;
      }
    }
    const boundaries = [0];
    const radius = Math.round(length / count * 0.22);
    for (let index = 1; index < count; index += 1) {
      const ideal = Math.round(length * index / count);
      let selected = ideal;
      for (let position = ideal - radius; position <= ideal + radius; position += 1) {
        if (
          counts[position] < counts[selected]
          || (
            counts[position] === counts[selected]
            && Math.abs(position - ideal) < Math.abs(selected - ideal)
          )
        ) selected = position;
      }
      boundaries.push(selected);
    }
    boundaries.push(length);
    return boundaries;
  };
  return {
    data,
    info,
    horizontalBoundaries: findValleyBoundaries("x", 3),
    verticalBoundaries: findValleyBoundaries("y", 4)
  };
}

async function alphaBounds(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("캐릭터 셀의 불투명 픽셀을 찾지 못했습니다.");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function normalizeCell(input) {
  const bounds = await alphaBounds(input);
  const visible = await sharp(input).extract(bounds).png().toBuffer();
  const scale = Math.min(
    1,
    (CELL_WIDTH - 12) / bounds.width,
    (CELL_HEIGHT - 8) / bounds.height
  );
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  const resized = scale === 1
    ? visible
    : await sharp(visible).resize(width, height, { fit: "fill" }).png().toBuffer();
  return sharp({
    create: {
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
      channels: 4,
      background: "#00000000"
    }
  }).composite([{
    input: resized,
    left: Math.round((CELL_WIDTH - width) / 2),
    top: CELL_HEIGHT - height - 4
  }]).png({ compressionLevel: 9 }).toBuffer();
}

async function extractGridCell(grid, row, column) {
  const left = grid.horizontalBoundaries[column];
  const right = grid.horizontalBoundaries[column + 1];
  const top = grid.verticalBoundaries[row];
  const bottom = grid.verticalBoundaries[row + 1];
  const extracted = await sharp(grid.data, { raw: grid.info })
    .extract({ left, top, width: right - left, height: bottom - top })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return normalizeCell(extracted);
}

async function extractFixedCell(sheet, row, column) {
  return sharp(sheet)
    .extract({
      left: column * CELL_WIDTH,
      top: row * CELL_HEIGHT,
      width: CELL_WIDTH,
      height: CELL_HEIGHT
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function canonicalizeDirections(sheet, guest) {
  const grid = await loadGrid(sheet);
  const front = await Promise.all([0, 1, 2].map((column) => extractGridCell(grid, 0, column)));
  const back = await Promise.all([0, 1, 2].map((column) => extractGridCell(grid, 3, column)));
  const leftRows = guest === "guest-01" ? [1, 1, 2] : [1, 1, 1];
  const left = await Promise.all(leftRows.map((row, column) => extractGridCell(grid, row, column)));
  const right = await Promise.all(left.map((frame) => sharp(frame).flop().png().toBuffer()));
  const rows = [front, left, right, back];
  const composites = rows.flatMap((frames, row) => frames.map((input, column) => ({
    input,
    left: column * CELL_WIDTH,
    top: row * CELL_HEIGHT
  })));
  return sharp({
    create: {
      width: SHEET_WIDTH,
      height: SHEET_HEIGHT,
      channels: 4,
      background: "#00000000"
    }
  }).composite(composites).png({ compressionLevel: 9 }).toBuffer();
}

async function mirroredProfileDifference(sheet) {
  let changedChannels = 0;
  let comparedChannels = 0;
  for (let column = 0; column < 3; column += 1) {
    const left = await extractFixedCell(sheet, 1, column);
    const right = await extractFixedCell(sheet, 2, column);
    const [{ data: mirrored }, { data: actual }] = await Promise.all([
      sharp(left).flop().ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(right).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    ]);
    comparedChannels += actual.length;
    for (let index = 0; index < actual.length; index += 1) {
      if (actual[index] !== mirrored[index]) changedChannels += 1;
    }
  }
  return changedChannels / comparedChannels;
}

export async function buildGuestSafeSourceSheets({
  inputRoot = defaultInputRoot,
  outputRoot = defaultOutputRoot,
  alphaMaskRoot = defaultAlphaMaskRoot
} = {}) {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  await mkdir(outputRoot, { recursive: true });
  const presets = [];
  for (const preset of catalog.presets) {
    const guest = preset.reference.walkSourceGuest;
    const input = path.join(inputRoot, `${guest}-walk-sheet.png`);
    const mask = path.join(alphaMaskRoot, `${guest}-alpha-mask.png`);
    const output = path.join(outputRoot, `${guest}-walk-sheet.png`);
    await access(input);
    const alpha = await makeSafeAlphaSheet(input, mask);
    const canonical = await canonicalizeDirections(alpha.cleaned, guest);
    const { data, info } = await sharp(canonical)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const finalAlpha = alphaMetrics(data, info.width, info.height);
    const profileDifference = await mirroredProfileDifference(canonical);
    if (profileDifference !== 0) {
      throw new Error(`${guest} 좌·우 방향이 정확한 반전 관계가 아닙니다.`);
    }
    await sharp(canonical).png({ compressionLevel: 9 }).toFile(output);
    presets.push({
      guest,
      source: path.relative(root, input),
      output: path.relative(root, output),
      hadRealAlpha: alpha.hadRealAlpha,
      alphaMask: alpha.maskApplied ? path.relative(root, mask) : null,
      before: alpha.before,
      after: finalAlpha,
      leftRightMirroredDifference: profileDifference,
      directionCorrection: guest === "guest-01"
        ? "left step 3 recovered from the source right row; right row mirrored from canonical left"
        : "right row mirrored from canonical left"
    });
  }
  const report = {
    version: 10,
    policy: {
      genuineAlphaRequired: true,
      opaqueSourcePolicy: "a reviewed subject alpha mask is mandatory; color-key deletion is forbidden",
      minimumTransparentPercentage: MINIMUM_TRANSPARENT_PERCENTAGE,
      maximumBorderOpaquePercentage: 0,
      leftRightMirroredDifference: 0,
      whiteGarmentProtection: "subject masks preserve white garments; partial edge RGB is decontaminated from the old matte"
    },
    summary: {
      presetCount: presets.length,
      appliedAlphaMaskSourceCount: presets.filter((preset) => preset.alphaMask).length,
      preservedAlphaSourceCount: presets.filter((preset) => preset.hadRealAlpha).length,
      minimumTransparentPercentage: Math.min(...presets.map((preset) => preset.after.transparentPercentage)),
      maximumBorderOpaquePercentage: Math.max(...presets.map((preset) => preset.after.borderOpaquePercentage)),
      maximumLeftRightMirroredDifference: Math.max(...presets.map((preset) => preset.leftRightMirroredDifference)),
      passed: presets.length === catalog.presets.length
        && presets.every((preset) => (
          preset.after.transparentPercentage >= MINIMUM_TRANSPARENT_PERCENTAGE
          && preset.after.borderOpaquePercentage === 0
          && preset.leftRightMirroredDifference === 0
        ))
    },
    presets
  };
  await writeFile(
    path.join(outputRoot, "source-integrity-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isMain) {
  const report = await buildGuestSafeSourceSheets();
  console.log(
    `하객 안전 원화 ${report.summary.presetCount}종 생성 완료: `
    + `불투명 배경 ${report.summary.appliedAlphaMaskSourceCount}종 마스크 적용, `
    + `기존 알파 ${report.summary.preservedAlphaSourceCount}종 보존`
  );
}
