#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import sharp from "sharp";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const catalogPath = path.join(root, "character-assets/guest-character-presets.json");
const pilotRoot = path.join(root, "character-assets/reference/guest-3d-master-sources/v1");
const defaultOutputRoot = path.join(root, "character-assets/source/guests-preview");
const defaultReviewPath = path.join(
  root,
  ".superpowers/character-review/guest-selection-preview-hd-ratio.png"
);
const directions = ["down", "left", "right", "up"];

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

async function alphaBounds(input, threshold = 12) {
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
  if (right < left || bottom < top) throw new Error("선택 화면 캐릭터의 불투명 픽셀을 찾지 못했습니다.");
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

async function transparentCanvas(width, height, composites) {
  return sharp({
    create: { width, height, channels: 4, background: "#00000000" }
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function samplePremultiplied(data, info, x, y) {
  const x0 = clamp(Math.floor(x), 0, info.width - 1);
  const x1 = clamp(x0 + 1, 0, info.width - 1);
  const y0 = clamp(Math.floor(y), 0, info.height - 1);
  const y1 = clamp(y0 + 1, 0, info.height - 1);
  const xWeight = clamp(x - x0, 0, 1);
  const yWeight = clamp(y - y0, 0, 1);
  const samples = [
    { offset: (y0 * info.width + x0) * 4, weight: (1 - xWeight) * (1 - yWeight) },
    { offset: (y0 * info.width + x1) * 4, weight: xWeight * (1 - yWeight) },
    { offset: (y1 * info.width + x0) * 4, weight: (1 - xWeight) * yWeight },
    { offset: (y1 * info.width + x1) * 4, weight: xWeight * yWeight }
  ];
  const alpha = samples.reduce((total, sample) => total + data[sample.offset + 3] * sample.weight, 0);
  if (alpha <= 0.5) return [0, 0, 0, 0];
  return [
    Math.round(samples.reduce(
      (total, sample) => total + data[sample.offset] * data[sample.offset + 3] * sample.weight,
      0
    ) / alpha),
    Math.round(samples.reduce(
      (total, sample) => total + data[sample.offset + 1] * data[sample.offset + 3] * sample.weight,
      0
    ) / alpha),
    Math.round(samples.reduce(
      (total, sample) => total + data[sample.offset + 2] * data[sample.offset + 3] * sample.weight,
      0
    ) / alpha),
    Math.round(alpha)
  ];
}

async function headBandWidth(input, policy, threshold = 12) {
  const bounds = await alphaBounds(input, threshold);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const headBottom = Math.min(info.height - 1, bounds.top + policy.headHeight - 1);
  let left = info.width;
  let right = -1;
  for (let y = bounds.top; y <= headBottom; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] <= threshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  if (right < left) throw new Error("선택 화면 캐릭터 머리 영역을 찾지 못했습니다.");
  return right - left + 1;
}

async function normalizeHeadWidth(input, policy) {
  let current = input;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const measured = await headBandWidth(current, policy);
    if (Math.abs(measured - policy.headWidth) <= 1) break;
    const scale = clamp(policy.headWidth / measured, 0.8, 1.25);
    const bounds = await alphaBounds(current);
    const { data, info } = await sharp(current).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const output = Buffer.alloc(data.length);
    const centerX = (info.width - 1) / 2;
    const headBottom = bounds.top + policy.headHeight - 1;
    const transitionEnd = headBottom + 18;
    for (let y = 0; y < info.height; y += 1) {
      const rowScale = y <= headBottom
        ? scale
        : y >= transitionEnd
          ? 1
          : scale + (1 - scale) * ((y - headBottom) / (transitionEnd - headBottom));
      for (let x = 0; x < info.width; x += 1) {
        const sourceX = centerX + (x - centerX) / rowScale;
        if (sourceX < 0 || sourceX > info.width - 1) continue;
        output.set(samplePremultiplied(data, info, sourceX, y), (y * info.width + x) * 4);
      }
    }
    current = await sharp(output, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
  }
  return current;
}

export async function normalizeSelectionPreviewFrame(input, policy) {
  const bounds = await alphaBounds(input);
  const visible = await sharp(input).extract(bounds).png().toBuffer();
  const scale = policy.contentHeight / bounds.height;
  const width = Math.min(policy.source.width - 8, Math.max(2, Math.round(bounds.width * scale)));
  const resized = await sharp(visible)
    .resize({ width, height: policy.contentHeight, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const normalized = await transparentCanvas(policy.source.width, policy.source.height, [{
    input: resized,
    left: Math.round((policy.source.width - width) / 2),
    top: policy.footBaseline - policy.contentHeight + 1
  }]);
  return normalizeHeadWidth(normalized, policy);
}

async function inspectFrame(input, policy) {
  const bounds = await alphaBounds(input);
  const measuredHeadWidth = await headBandWidth(input, policy);
  return {
    top: bounds.top,
    bottom: bounds.bottom,
    characterHeight: bounds.height,
    headHeight: policy.headHeight,
    bodyHeight: policy.contentHeight - policy.headHeight,
    bodyToHeadRatio: (policy.contentHeight - policy.headHeight) / policy.headHeight,
    headWidth: measuredHeadWidth,
    headWidthDelta: measuredHeadWidth - policy.headWidth
  };
}

function framePath(rootPath, presetId, kind) {
  return path.join(rootPath, `${presetId}__${kind}.png`);
}

async function inspectPreviewSheets({ catalog, outputRoot }) {
  const policy = catalog.frame.selectionPreview;
  const presets = [];
  let frameCount = 0;
  for (const preset of catalog.presets) {
    const walkPath = framePath(outputRoot, preset.id, "walk");
    const idlePath = framePath(outputRoot, preset.id, "idle");
    const walkMetadata = await sharp(walkPath).metadata();
    const idleMetadata = await sharp(idlePath).metadata();
    if (
      walkMetadata.width !== policy.walk.sheet.width
      || walkMetadata.height !== policy.walk.sheet.height
      || idleMetadata.width !== policy.idle.sheet.width
      || idleMetadata.height !== policy.idle.sheet.height
    ) {
      throw new Error(`${preset.id} 선택 화면 고해상도 시트 규격이 잘못됐습니다.`);
    }
    const directionMetrics = {};
    for (let row = 0; row < directions.length; row += 1) {
      const direction = directions[row];
      directionMetrics[direction] = [];
      for (let column = 0; column < 3; column += 1) {
        const frame = await sharp(walkPath)
          .extract({
            left: column * policy.source.width,
            top: row * policy.source.height,
            width: policy.source.width,
            height: policy.source.height
          })
          .png()
          .toBuffer();
        directionMetrics[direction].push(await inspectFrame(frame, policy));
        frameCount += 1;
      }
    }
    presets.push({ id: preset.id, guest: preset.reference.walkSourceGuest, directions: directionMetrics });
  }
  const frames = presets.flatMap((preset) => Object.values(preset.directions).flat());
  const failures = frames.filter((frame) => (
    Math.abs(frame.characterHeight - policy.contentHeight) > 1
    || Math.abs(frame.bottom - policy.footBaseline) > 1
    || Math.abs(frame.headWidthDelta) > 2
    || frame.bodyToHeadRatio !== 2
  ));
  const headWidths = frames.map((frame) => frame.headWidth);
  const report = {
    version: 1,
    policy: {
      source: policy.source,
      contentHeight: policy.contentHeight,
      headHeight: policy.headHeight,
      bodyHeight: policy.contentHeight - policy.headHeight,
      headWidth: policy.headWidth,
      footBaseline: policy.footBaseline,
      maximumHeadWidthDelta: 2
    },
    summary: {
      presetCount: presets.length,
      frameCount,
      minimumHeadWidth: Math.min(...headWidths),
      maximumHeadWidth: Math.max(...headWidths),
      maximumHeadWidthDelta: Math.max(...headWidths.map((width) => Math.abs(width - policy.headWidth))),
      exactBodyToHeadRatio: frames.every((frame) => frame.bodyToHeadRatio === 2),
      passed: failures.length === 0
    },
    presets
  };
  if (!report.summary.passed) {
    throw new Error(`선택 화면 3등신·머리 크기 감사 실패: ${failures.length}개 프레임`);
  }
  return report;
}

async function renderReview({ catalog, outputRoot, reviewPath }) {
  const policy = catalog.frame.selectionPreview;
  const cardWidth = 420;
  const cardHeight = 178;
  const columns = 3;
  const gap = 12;
  const padding = 16;
  const frameWidth = 84;
  const frameHeight = 126;
  const frameScale = frameWidth / policy.source.width;
  const composites = [];
  for (let index = 0; index < catalog.presets.length; index += 1) {
    const preset = catalog.presets[index];
    const cardX = padding + (index % columns) * (cardWidth + gap);
    const cardY = padding + Math.floor(index / columns) * (cardHeight + gap);
    const walkPath = framePath(outputRoot, preset.id, "walk");
    const label = Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${cardWidth}" height="${cardHeight}" rx="14" fill="#fffdf8" stroke="#d8cbc2"/>
      <text x="14" y="21" font-family="sans-serif" font-size="12" font-weight="700" fill="#594f4b">${preset.reference.walkSourceGuest} · ${preset.id}</text>
    </svg>`);
    composites.push({ input: label, left: cardX, top: cardY });
    for (let row = 0; row < directions.length; row += 1) {
      const frame = await sharp(walkPath)
        .extract({
          left: policy.source.width,
          top: row * policy.source.height,
          width: policy.source.width,
          height: policy.source.height
        })
        .resize(frameWidth, frameHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer();
      const frameX = cardX + 14 + row * (frameWidth + 16);
      const frameY = cardY + 34;
      composites.push({ input: frame, left: frameX, top: frameY });
      const top = frameY + (policy.footBaseline - policy.contentHeight + 1) * frameScale;
      const head = top + policy.headHeight * frameScale;
      const body = head + policy.headHeight * frameScale;
      const foot = frameY + policy.footBaseline * frameScale;
      const guides = Buffer.from(`<svg width="${frameWidth}" height="${frameHeight}" xmlns="http://www.w3.org/2000/svg">
        <text x="3" y="10" font-family="sans-serif" font-size="8" fill="#655a56">${directions[row]}</text>
        <path d="M0 ${top - frameY}H${frameWidth}" stroke="#3b82f6" stroke-width="0.7"/>
        <path d="M0 ${head - frameY}H${frameWidth}" stroke="#ef4444" stroke-width="0.8"/>
        <path d="M0 ${body - frameY}H${frameWidth}" stroke="#f59e0b" stroke-width="0.7"/>
        <path d="M0 ${foot - frameY}H${frameWidth}" stroke="#22c55e" stroke-width="0.7"/>
      </svg>`);
      composites.push({ input: guides, left: frameX, top: frameY });
    }
  }
  const rows = Math.ceil(catalog.presets.length / columns);
  await mkdir(path.dirname(reviewPath), { recursive: true });
  await sharp({
    create: {
      width: padding * 2 + columns * cardWidth + (columns - 1) * gap,
      height: padding * 2 + rows * cardHeight + (rows - 1) * gap,
      channels: 4,
      background: "#eee8e2"
    }
  }).composite(composites).png().toFile(reviewPath);
}

export async function auditGuestSelectionPreviewAssets({
  catalog: providedCatalog,
  outputRoot = defaultOutputRoot
} = {}) {
  const catalog = providedCatalog ?? JSON.parse(await readFile(catalogPath, "utf8"));
  return inspectPreviewSheets({ catalog, outputRoot });
}

export async function buildGuestSelectionPreviewAssets({
  rebuildPilots = true,
  catalog: providedCatalog,
  outputRoot = defaultOutputRoot,
  reviewPath = defaultReviewPath
} = {}) {
  const catalog = providedCatalog ?? JSON.parse(await readFile(catalogPath, "utf8"));
  const policy = catalog.frame.selectionPreview;
  await mkdir(outputRoot, { recursive: true });
  for (const preset of catalog.presets) {
    const guest = preset.reference.walkSourceGuest;
    if (rebuildPilots) {
      await execFileAsync(process.execPath, [
        path.join(root, "scripts/build-guest-3d-sprite-pilot.mjs"),
        "--guest",
        guest,
        "--preset",
        preset.id
      ], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    }
    const framesByDirection = {};
    for (const direction of directions) {
      framesByDirection[direction] = [];
      for (let step = 1; step <= 3; step += 1) {
        const source = path.join(
          pilotRoot,
          guest,
          "pilot/sources",
          direction,
          `step-${String(step).padStart(2, "0")}-source.png`
        );
        framesByDirection[direction].push(await normalizeSelectionPreviewFrame(source, policy));
      }
    }
    const walkComposites = [];
    for (let row = 0; row < directions.length; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        walkComposites.push({
          input: framesByDirection[directions[row]][column],
          left: column * policy.source.width,
          top: row * policy.source.height
        });
      }
    }
    const walk = await transparentCanvas(policy.walk.sheet.width, policy.walk.sheet.height, walkComposites);
    const neutral = framesByDirection.down[1];
    const idle = await transparentCanvas(policy.idle.sheet.width, policy.idle.sheet.height, [
      { input: neutral, left: 0, top: 0 },
      { input: neutral, left: policy.source.width, top: 0 }
    ]);
    await Promise.all([
      writeFile(framePath(outputRoot, preset.id, "walk"), walk),
      writeFile(framePath(outputRoot, preset.id, "idle"), idle)
    ]);
  }
  const report = await inspectPreviewSheets({ catalog, outputRoot });
  await writeFile(
    path.join(outputRoot, "selection-preview-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await renderReview({ catalog, outputRoot, reviewPath });
  return { report, reviewPath, outputRoot };
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const skipPilotBuild = process.argv.includes("--skip-pilot-build");
  if (checkOnly) {
    const report = await auditGuestSelectionPreviewAssets();
    console.log(
      `선택 화면 고해상도 3등신 감사 통과: ${report.summary.presetCount}명 · `
      + `${report.summary.frameCount}프레임 · 머리 폭 ${report.summary.minimumHeadWidth}-${report.summary.maximumHeadWidth}px`
    );
    return;
  }
  const result = await buildGuestSelectionPreviewAssets({ rebuildPilots: !skipPilotBuild });
  console.log(
    `선택 화면 고해상도 캐릭터 생성 완료: ${result.report.summary.presetCount}명 · `
    + `${result.report.summary.frameCount}프레임`
  );
  console.log(result.reviewPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
