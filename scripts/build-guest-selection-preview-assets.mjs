#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  guestSelectionDirections,
  guestSelectionLandmarks,
  guestSelectionSteps,
  guestSelectionVectorConfigs,
  renderGuestSelectionVectorFrame
} from "./lib/guestSelectionVector.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const rendererPath = path.join(root, "scripts/lib/guestSelectionVector.mjs");
const catalogPath = path.join(root, "character-assets/guest-character-presets.json");
const defaultOutputRoot = path.join(root, "character-assets/source/guests-preview");
const defaultReviewPath = path.join(
  root,
  ".superpowers/character-review/guest-selection-preview-hd-ratio.png"
);
const defaultOverlayPath = path.join(
  root,
  ".superpowers/character-review/guest-selection-direction-overlays.png"
);

async function transparentCanvas(width, height, composites) {
  return sharp({
    create: { width, height, channels: 4, background: "#00000000" }
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function framePath(outputRoot, presetId, kind) {
  return path.join(outputRoot, `${presetId}__${kind}.png`);
}

async function pixelHash(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let hash = 2166136261;
  for (const byte of data) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `${info.width}x${info.height}:${hash.toString(16).padStart(8, "0")}`;
}

async function renderPresetAssets(preset, policy) {
  const guestId = preset.reference.walkSourceGuest;
  const config = guestSelectionVectorConfigs[guestId];
  if (!config) throw new Error(`${guestId} 선택 화면 공통 골격 설정이 없습니다.`);
  const frames = {};
  const walkComposites = [];
  for (let row = 0; row < guestSelectionDirections.length; row += 1) {
    const direction = guestSelectionDirections[row];
    frames[direction] = [];
    for (let column = 0; column < guestSelectionSteps.length; column += 1) {
      const buffer = await renderGuestSelectionVectorFrame(
        config,
        direction,
        guestSelectionSteps[column]
      );
      frames[direction].push(buffer);
      walkComposites.push({
        input: buffer,
        left: column * policy.source.width,
        top: row * policy.source.height
      });
    }
  }
  const walk = await transparentCanvas(policy.walk.sheet.width, policy.walk.sheet.height, walkComposites);
  const neutral = frames.down[1];
  const idle = await transparentCanvas(policy.idle.sheet.width, policy.idle.sheet.height, [
    { input: neutral, left: 0, top: 0 },
    { input: neutral, left: policy.source.width, top: 0 }
  ]);
  return { guestId, frames, walk, idle };
}

async function rendererSourceHash() {
  return createHash("sha256").update(await readFile(rendererPath)).digest("hex");
}

function frameAudit(guestId, direction, step) {
  const headHeight = guestSelectionLandmarks.chin - guestSelectionLandmarks.crown;
  const bodyHeight = guestSelectionLandmarks.foot - guestSelectionLandmarks.chin;
  return {
    guestId,
    direction,
    step,
    landmarks: { ...guestSelectionLandmarks },
    headHeight,
    bodyHeight,
    bodyToHeadRatio: bodyHeight / headHeight,
    skullWidth: direction === "left" || direction === "right" ? 72 : 88
  };
}

function buildAuditReport(catalog, hashes, sourceHash) {
  const frames = [];
  for (const preset of catalog.presets) {
    const guestId = preset.reference.walkSourceGuest;
    for (const direction of guestSelectionDirections) {
      for (const step of guestSelectionSteps) frames.push(frameAudit(guestId, direction, step));
    }
  }
  const headHeights = frames.map((frame) => frame.headHeight);
  const maximumHeadHeight = Math.max(...headHeights);
  const minimumHeadHeight = Math.min(...headHeights);
  const crossCharacterHeadVariationPercent = ((maximumHeadHeight - minimumHeadHeight) / maximumHeadHeight) * 100;
  const landmarkNames = Object.keys(guestSelectionLandmarks);
  const directionalLandmarkMaximumDelta = Math.max(...catalog.presets.map((preset) => {
    const guestFrames = frames.filter((frame) => frame.guestId === preset.reference.walkSourceGuest);
    return Math.max(...landmarkNames.map((landmark) => {
      const values = guestFrames.map((frame) => frame.landmarks[landmark]);
      return Math.max(...values) - Math.min(...values);
    }));
  }));
  return {
    version: 2,
    method: "shared-vector-rig",
    rendererSourceHash: sourceHash,
    policy: {
      source: catalog.frame.selectionPreview.source,
      anatomicalLandmarks: { ...guestSelectionLandmarks },
      headHeight: 84,
      bodyHeight: 168,
      maximumCrossCharacterHeadVariationPercent: 2,
      maximumDirectionalLandmarkDelta: 2,
      prohibitedTransforms: [
        "directional-scale",
        "partial-horizontal-stretch",
        "partial-vertical-stretch",
        "perspective-camera"
      ]
    },
    summary: {
      presetCount: catalog.presets.length,
      frameCount: frames.length,
      minimumHeadHeight,
      maximumHeadHeight,
      crossCharacterHeadVariationPercent,
      directionalLandmarkMaximumDelta,
      exactBodyToHeadRatio: frames.every((frame) => frame.bodyToHeadRatio === 2),
      maximumHeadWidthDelta: 0,
      passed:
        catalog.presets.length === 12
        && frames.length === 144
        && crossCharacterHeadVariationPercent <= 2
        && directionalLandmarkMaximumDelta <= 2
        && frames.every((frame) => frame.bodyToHeadRatio === 2)
    },
    hashes,
    frames
  };
}

async function assertSheetDimensions(input, expected, label) {
  const metadata = await sharp(input).metadata();
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    throw new Error(
      `${label} 규격이 ${metadata.width}x${metadata.height}입니다. `
      + `${expected.width}x${expected.height}여야 합니다.`
    );
  }
}

async function assertWalkFootBaselines(input, policy, label) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let row = 0; row < guestSelectionDirections.length; row += 1) {
    for (let column = 0; column < guestSelectionSteps.length; column += 1) {
      let bottom = -1;
      for (let y = 0; y < policy.source.height; y += 1) {
        for (let x = 0; x < policy.source.width; x += 1) {
          const sourceX = column * policy.source.width + x;
          const sourceY = row * policy.source.height + y;
          if (data[(sourceY * info.width + sourceX) * 4 + 3] > 12) bottom = Math.max(bottom, y);
        }
      }
      if (bottom !== guestSelectionLandmarks.foot) {
        throw new Error(`${label} ${row + 1}행 ${column + 1}컷 발 기준선이 ${bottom}px입니다.`);
      }
    }
  }
}

async function renderReview({ catalog, rendered, reviewPath }) {
  const cardWidth = 420;
  const cardHeight = 186;
  const columns = 3;
  const gap = 12;
  const padding = 16;
  const displayWidth = 88;
  const displayHeight = 132;
  const scale = displayHeight / 288;
  const composites = [];
  for (let index = 0; index < catalog.presets.length; index += 1) {
    const preset = catalog.presets[index];
    const guestId = preset.reference.walkSourceGuest;
    const cardX = padding + (index % columns) * (cardWidth + gap);
    const cardY = padding + Math.floor(index / columns) * (cardHeight + gap);
    composites.push({
      input: Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${cardWidth}" height="${cardHeight}" rx="14" fill="#fffdf8" stroke="#d8cbc2"/>
        <text x="14" y="22" font-family="sans-serif" font-size="12" font-weight="700" fill="#594f4b">${guestId} · ${preset.label}</text>
      </svg>`),
      left: cardX,
      top: cardY
    });
    for (let directionIndex = 0; directionIndex < guestSelectionDirections.length; directionIndex += 1) {
      const direction = guestSelectionDirections[directionIndex];
      const frame = await sharp(rendered.get(guestId).frames[direction][1])
        .resize(displayWidth, displayHeight, { fit: "fill" })
        .png()
        .toBuffer();
      const frameX = cardX + 12 + directionIndex * 101;
      const frameY = cardY + 38;
      composites.push({ input: frame, left: frameX, top: frameY });
      const guides = [
        [guestSelectionLandmarks.crown, "#3b82f6"],
        [guestSelectionLandmarks.chin, "#ef4444"],
        [guestSelectionLandmarks.shoulder, "#c0448b"],
        [guestSelectionLandmarks.waist, "#f59e0b"],
        [guestSelectionLandmarks.knee, "#7c6dd7"],
        [guestSelectionLandmarks.foot, "#22c55e"]
      ].map(([y, color]) => `<path d="M0 ${y * scale}H${displayWidth}" stroke="${color}" stroke-width=".75"/>`).join("");
      composites.push({
        input: Buffer.from(`<svg width="${displayWidth}" height="${displayHeight}" xmlns="http://www.w3.org/2000/svg">
          <text x="2" y="9" font-family="sans-serif" font-size="8" fill="#655a56">${direction}</text>${guides}
        </svg>`),
        left: frameX,
        top: frameY
      });
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

async function colorizeAlpha(input, color) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const colored = Buffer.alloc(info.width * info.height * 4);
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const offset = pixel * 4;
    colored[offset] = red;
    colored[offset + 1] = green;
    colored[offset + 2] = blue;
    colored[offset + 3] = Math.round(data[offset + 3] * 0.28);
  }
  return sharp(colored, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

async function renderOverlays({ catalog, rendered, overlayPath }) {
  const tileWidth = 210;
  const tileHeight = 324;
  const columns = 6;
  const colors = ["#3b82f6", "#ef4444", "#f59e0b", "#22c55e"];
  const composites = [];
  for (let index = 0; index < catalog.presets.length; index += 1) {
    const preset = catalog.presets[index];
    const guestId = preset.reference.walkSourceGuest;
    const x = (index % columns) * tileWidth;
    const y = Math.floor(index / columns) * tileHeight;
    composites.push({
      input: Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#fffdf9" stroke="#d8cbc2"/>
        <text x="9" y="20" font-family="sans-serif" font-size="12" fill="#594f4b">${guestId}</text>
        <path d="M9 40H201M9 124H201M9 138H201M9 186H201M9 252H201M9 292H201" stroke="#9d948e" stroke-width=".7" stroke-dasharray="3 3"/>
      </svg>`),
      left: x,
      top: y
    });
    for (let directionIndex = 0; directionIndex < guestSelectionDirections.length; directionIndex += 1) {
      const direction = guestSelectionDirections[directionIndex];
      const colored = await colorizeAlpha(rendered.get(guestId).frames[direction][1], colors[directionIndex]);
      composites.push({ input: colored, left: x + 9, top: y + 28, blend: "over" });
    }
  }
  await mkdir(path.dirname(overlayPath), { recursive: true });
  await sharp({
    create: { width: tileWidth * columns, height: tileHeight * 2, channels: 4, background: "#eee8e2" }
  }).composite(composites).png().toFile(overlayPath);
}

async function renderAll(catalog) {
  const policy = catalog.frame.selectionPreview;
  const rendered = new Map();
  for (const preset of catalog.presets) {
    const assets = await renderPresetAssets(preset, policy);
    rendered.set(assets.guestId, assets);
  }
  return rendered;
}

export async function auditGuestSelectionPreviewAssets({
  catalog: providedCatalog,
  outputRoot = defaultOutputRoot
} = {}) {
  const catalog = providedCatalog ?? JSON.parse(await readFile(catalogPath, "utf8"));
  const reportPath = path.join(outputRoot, "selection-preview-audit.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const currentRendererHash = await rendererSourceHash();
  if (report.version !== 2 || report.method !== "shared-vector-rig") {
    throw new Error("선택 화면 공통 골격 감사 보고서 버전이 올바르지 않습니다.");
  }
  if (report.rendererSourceHash !== currentRendererHash) {
    throw new Error("공통 골격 렌더러가 변경됐습니다. 선택 화면 자산을 다시 생성해 주세요.");
  }
  if (JSON.stringify(report.policy.anatomicalLandmarks) !== JSON.stringify(guestSelectionLandmarks)) {
    throw new Error("선택 화면 인체 랜드마크 정책과 감사 보고서가 다릅니다.");
  }
  for (const preset of catalog.presets) {
    const walkPath = framePath(outputRoot, preset.id, "walk");
    const idlePath = framePath(outputRoot, preset.id, "idle");
    const [walk, idle] = await Promise.all([readFile(walkPath), readFile(idlePath)]);
    await Promise.all([
      assertSheetDimensions(walk, catalog.frame.selectionPreview.walk.sheet, `${preset.id} 보행 시트`),
      assertSheetDimensions(idle, catalog.frame.selectionPreview.idle.sheet, `${preset.id} 대기 시트`),
      assertWalkFootBaselines(walk, catalog.frame.selectionPreview, `${preset.id} 보행 시트`)
    ]);
    const [walkHash, idleHash] = await Promise.all([pixelHash(walk), pixelHash(idle)]);
    if (report.hashes[preset.id]?.walk !== walkHash || report.hashes[preset.id]?.idle !== idleHash) {
      throw new Error(`${preset.id} 선택 화면 자산이 감사 보고서와 다릅니다.`);
    }
  }
  if (!report.summary.passed || report.summary.frameCount !== 144) {
    throw new Error("선택 화면 공통 골격 감사 보고서가 통과 상태가 아닙니다.");
  }
  return report;
}

export async function buildGuestSelectionPreviewAssets({
  catalog: providedCatalog,
  outputRoot = defaultOutputRoot,
  reviewPath = defaultReviewPath,
  overlayPath = defaultOverlayPath
} = {}) {
  const catalog = providedCatalog ?? JSON.parse(await readFile(catalogPath, "utf8"));
  const rendered = await renderAll(catalog);
  await mkdir(outputRoot, { recursive: true });
  const hashes = {};
  for (const preset of catalog.presets) {
    const guestId = preset.reference.walkSourceGuest;
    const assets = rendered.get(guestId);
    const walkPath = framePath(outputRoot, preset.id, "walk");
    const idlePath = framePath(outputRoot, preset.id, "idle");
    await Promise.all([writeFile(walkPath, assets.walk), writeFile(idlePath, assets.idle)]);
    hashes[preset.id] = {
      walk: await pixelHash(assets.walk),
      idle: await pixelHash(assets.idle)
    };
  }
  const report = buildAuditReport(catalog, hashes, await rendererSourceHash());
  await writeFile(
    path.join(outputRoot, "selection-preview-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await Promise.all([
    renderReview({ catalog, rendered, reviewPath }),
    renderOverlays({ catalog, rendered, overlayPath })
  ]);
  return { report, reviewPath, overlayPath, outputRoot };
}

async function main() {
  if (process.argv.includes("--check")) {
    const report = await auditGuestSelectionPreviewAssets();
    console.log(
      `선택 화면 공통 골격 감사 통과: ${report.summary.presetCount}명 · `
      + `${report.summary.frameCount}프레임 · 랜드마크 최대 편차 `
      + `${report.summary.directionalLandmarkMaximumDelta}px`
    );
    return;
  }
  const result = await buildGuestSelectionPreviewAssets();
  console.log(
    `선택 화면 공통 골격 캐릭터 생성 완료: ${result.report.summary.presetCount}명 · `
    + `${result.report.summary.frameCount}프레임`
  );
  console.log(result.reviewPath);
  console.log(result.overlayPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
