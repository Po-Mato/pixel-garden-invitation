import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { cleanGuestHairSheet, waveHairPresetIds } from "./guestHairBackground.mjs";
import { DEFAULT_FOREGROUND_PLACEMENTS } from "./mapForegroundAuditRenderer.mjs";

export const mapToneCharacterPositions = Object.freeze({
  home: { x: 285, y: 555 },
  neighborhood: { x: 600, y: 375 },
  "subway-station": { x: 435, y: 435 },
  "subway-train": { x: 720, y: 285 },
  "venue-exterior": { x: 465, y: 600 },
  lobby: { x: 525, y: 600 },
  "bridal-room": { x: 345, y: 525 },
  "ceremony-hall": { x: 375, y: 1500 },
  banquet: { x: 570, y: 465 },
  restroom: { x: 270, y: 435 }
});

export function relativeLuminance([red, green, blue]) {
  const linear = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(first, second) {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export const displayCalibrationProfiles = Object.freeze({
  oled: {
    label: "OLED",
    adjustLuminance(value) {
      const bounded = Math.max(0, Math.min(1, value));
      return bounded < 0.08 ? bounded * 0.78 : Math.min(1, bounded ** 0.94);
    }
  },
  lcd: {
    label: "LCD",
    adjustLuminance(value) {
      return Math.max(0, Math.min(1, 0.025 + Math.max(0, Math.min(1, value)) * 0.91));
    }
  }
});

export function calibratedLabelContrasts(metrics, adjustLuminance = (value) => value) {
  const portalInk = adjustLuminance(relativeLuminance([26, 39, 48]));
  const portalText = adjustLuminance(relativeLuminance([248, 255, 255]));
  const portalSurface = portalInk * 0.88 + adjustLuminance(metrics.sceneP90Luminance ?? metrics.p90Luminance) * 0.12;
  return {
    spot: contrastRatio(
      adjustLuminance(relativeLuminance([52, 43, 45])),
      adjustLuminance(relativeLuminance([255, 253, 248]))
    ),
    portal: contrastRatio(portalText, portalSurface),
    npc: contrastRatio(
      adjustLuminance(relativeLuminance([63, 53, 56])),
      adjustLuminance(relativeLuminance([255, 253, 249]))
    )
  };
}

export function evaluateMapToneMetrics(metrics, expected, thresholds) {
  const contrasts = calibratedLabelContrasts(metrics);
  const issues = [];

  for (const key of [
    "averageLuminance",
    "p10Luminance",
    "p90Luminance",
    "sceneAverageLuminance",
    "sceneP10Luminance",
    "sceneP90Luminance"
  ]) {
    if (!Number.isFinite(expected[key])) continue;
    if (!Number.isFinite(metrics[key])) {
      issues.push(`${key} 측정 누락`);
      continue;
    }
    if (Math.abs(metrics[key] - expected[key]) > thresholds.maxLuminanceDelta) {
      issues.push(`${key} 기준선 이탈`);
    }
  }
  if (metrics.p90Luminance - metrics.p10Luminance < thresholds.minDynamicRange) {
    issues.push("맵 명암 폭 부족");
  }
  if (
    Number.isFinite(metrics.sceneP90Luminance)
    && metrics.sceneP90Luminance - metrics.sceneP10Luminance < thresholds.minDynamicRange
  ) issues.push("합성 장면 명암 폭 부족");
  const expectedPresetContrasts = expected.characterEdgeContrasts;
  const actualPresetContrasts = metrics.characterEdgeContrasts;
  if (expectedPresetContrasts && typeof expectedPresetContrasts === "object") {
    const expectedPresetIds = Object.keys(expectedPresetContrasts).sort();
    const actualPresetIds = Object.keys(actualPresetContrasts ?? {}).sort();
    if (JSON.stringify(actualPresetIds) !== JSON.stringify(expectedPresetIds)) {
      issues.push("캐릭터 프리셋 대비 목록 불일치");
    }
    for (const presetId of expectedPresetIds) {
      const actual = actualPresetContrasts?.[presetId];
      const baseline = expectedPresetContrasts[presetId];
      if (!Number.isFinite(actual)) {
        issues.push(`${presetId} 캐릭터 가장자리 대비 측정 누락`);
        continue;
      }
      if (actual < thresholds.minCharacterEdgeContrast) {
        issues.push(`${presetId} 캐릭터 가장자리 대비 부족`);
      }
      if (Math.abs(actual - baseline) > thresholds.maxCharacterEdgeContrastDelta) {
        issues.push(`${presetId} 캐릭터 가장자리 대비 기준선 이탈`);
      }
    }
  } else {
    if (
      Number.isFinite(metrics.characterEdgeContrast)
      && metrics.characterEdgeContrast < thresholds.minCharacterEdgeContrast
    ) issues.push("캐릭터 가장자리 대비 부족");
    if (
      Number.isFinite(expected.characterEdgeContrast)
      && !Number.isFinite(metrics.characterEdgeContrast)
    ) issues.push("캐릭터 가장자리 대비 측정 누락");
    else if (
      Number.isFinite(expected.characterEdgeContrast)
      && Math.abs(metrics.characterEdgeContrast - expected.characterEdgeContrast) > thresholds.maxCharacterEdgeContrastDelta
    ) issues.push("캐릭터 가장자리 대비 기준선 이탈");
  }
  if (
    Number.isInteger(expected.characterPresetCount)
    && metrics.characterPresetCount !== expected.characterPresetCount
  ) issues.push("캐릭터 프리셋 감사 수 불일치");
  const expectedMovementContrasts = expected.characterMovementEdgeContrasts;
  const actualMovementContrasts = metrics.characterMovementEdgeContrasts;
  if (expectedMovementContrasts && typeof expectedMovementContrasts === "object") {
    const expectedPresetIds = Object.keys(expectedMovementContrasts).sort();
    const actualPresetIds = Object.keys(actualMovementContrasts ?? {}).sort();
    if (JSON.stringify(actualPresetIds) !== JSON.stringify(expectedPresetIds)) {
      issues.push("이동 캐릭터 프리셋 대비 목록 불일치");
    }
    for (const presetId of expectedPresetIds) {
      const expectedFrames = expectedMovementContrasts[presetId];
      const actualFrames = actualMovementContrasts?.[presetId];
      const expectedFrameIds = Object.keys(expectedFrames).sort();
      const actualFrameIds = Object.keys(actualFrames ?? {}).sort();
      if (JSON.stringify(actualFrameIds) !== JSON.stringify(expectedFrameIds)) {
        issues.push(`${presetId} 이동 프레임 대비 목록 불일치`);
      }
      for (const frameId of expectedFrameIds) {
        const actual = actualFrames?.[frameId];
        const baseline = expectedFrames[frameId];
        if (!Number.isFinite(actual)) {
          issues.push(`${presetId}/${frameId} 이동 가장자리 대비 측정 누락`);
          continue;
        }
        if (actual < thresholds.minCharacterEdgeContrast) {
          issues.push(`${presetId}/${frameId} 이동 가장자리 대비 부족`);
        }
        if (Math.abs(actual - baseline) > thresholds.maxCharacterEdgeContrastDelta) {
          issues.push(`${presetId}/${frameId} 이동 가장자리 대비 기준선 이탈`);
        }
      }
    }
  }
  if (
    Number.isInteger(expected.movementFrameCount)
    && metrics.movementFrameCount !== expected.movementFrameCount
  ) issues.push("캐릭터 이동 프레임 감사 수 불일치");
  if (
    Number.isFinite(expected.foregroundAssetCount)
    && metrics.foregroundAssetCount !== expected.foregroundAssetCount
  ) issues.push("합성 전경 수 불일치");
  for (const [label, ratio] of [["스팟", contrasts.spot], ["포털", contrasts.portal], ["NPC", contrasts.npc]]) {
    if (ratio < thresholds.minTextContrast) issues.push(`${label} 라벨 대비 부족`);
  }

  for (const [profileId, profile] of Object.entries(displayCalibrationProfiles)) {
    const report = metrics.displayProfiles?.[profileId];
    if (!report) {
      issues.push(`${profile.label} 표시 보정 측정 누락`);
      continue;
    }
    for (const [label, ratio] of Object.entries(report.contrasts ?? {})) {
      if (ratio < thresholds.minTextContrast) issues.push(`${profile.label} ${label} 라벨 대비 부족`);
    }
    for (const [presetId, ratio] of Object.entries(report.characterEdgeContrasts ?? {})) {
      if (ratio < thresholds.minDisplayCharacterEdgeContrast) {
        issues.push(`${profile.label} ${presetId} 캐릭터 가장자리 대비 부족`);
      }
    }
    for (const [presetId, frames] of Object.entries(report.characterMovementEdgeContrasts ?? {})) {
      for (const [frameId, ratio] of Object.entries(frames)) {
        if (ratio < thresholds.minDisplayCharacterEdgeContrast) {
          issues.push(`${profile.label} ${presetId}/${frameId} 이동 가장자리 대비 부족`);
        }
      }
    }
  }

  return { issues, contrasts };
}

export async function measureMapTone(imagePath) {
  const { data, info } = await sharp(imagePath)
    .resize({ width: 120 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luminances = [];
  for (let offset = 0; offset < data.length; offset += info.channels) {
    luminances.push(relativeLuminance([data[offset], data[offset + 1], data[offset + 2]]));
  }
  luminances.sort((left, right) => left - right);
  return {
    averageLuminance: luminances.reduce((sum, value) => sum + value, 0) / luminances.length,
    p10Luminance: luminances[Math.floor(luminances.length * 0.1)],
    p90Luminance: luminances[Math.floor(luminances.length * 0.9)]
  };
}

function rgbaFromCss(value) {
  const match = value.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
  if (!match) throw new Error(`Invalid RGBA color: ${value}`);
  return { red: Number(match[1]), green: Number(match[2]), blue: Number(match[3]), alpha: Number(match[4]) };
}

export function characterEdgeShadowsFromCss(css, zoneIds) {
  return Object.fromEntries(zoneIds.map((zoneId) => {
    const escapedZoneId = zoneId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = css.match(new RegExp(`\\.world-map__stage\\[data-zone="${escapedZoneId}"\\]\\s*\\{([\\s\\S]*?)\\}`))?.[1];
    const value = block?.match(/--character-edge-shadow:\s*(rgba\([^;]+\))/)?.[1];
    if (!value) throw new Error(`Missing character edge shadow for ${zoneId}`);
    return [zoneId, rgbaFromCss(value)];
  }));
}

async function loadToneCharacters(rootDir) {
  const manifest = JSON.parse(await readFile(path.join(rootDir, "character-assets/guest-character-presets.json"), "utf8"));
  if (!manifest.presets.some(({ id }) => id === manifest.defaultPresetId)) {
    throw new Error("Default tone-audit character preset is missing");
  }
  const source = manifest.frame.source;
  const display = manifest.frame.display.world;
  const characters = await Promise.all(manifest.presets.map(async (preset) => {
    const idleInput = path.join(rootDir, preset.source.idle);
    const walkInput = path.join(rootDir, preset.source.walk);
    const [renderIdleInput, renderWalkInput] = waveHairPresetIds.has(preset.id)
      ? await Promise.all([
        cleanGuestHairSheet(idleInput, source),
        cleanGuestHairSheet(walkInput, source)
      ])
      : [idleInput, walkInput];
    const buffer = await sharp(renderIdleInput)
      .extract({ left: 0, top: 0, width: source.width, height: source.height })
      .resize(display.width, display.height, { kernel: sharp.kernel.nearest })
      .png()
      .toBuffer();
    const movementFrames = await Promise.all(Array.from({ length: manifest.frame.walk.columns }, async (_, index) => ({
      frameId: `down-${index}`,
      buffer: await sharp(renderWalkInput)
        .extract({ left: index * source.width, top: 0, width: source.width, height: source.height })
        .resize(display.width, display.height, { kernel: sharp.kernel.nearest })
        .png()
        .toBuffer()
    })));
    return {
      buffer,
      movementFrames,
      width: display.width,
      height: display.height,
      presetId: preset.id
    };
  }));
  return { characters, defaultPresetId: manifest.defaultPresetId };
}

async function characterShadow(characterBuffer, color) {
  const { data, info } = await sharp(characterBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const shadow = Buffer.alloc(data.length);
  for (let offset = 0; offset < data.length; offset += info.channels) {
    shadow[offset] = color.red;
    shadow[offset + 1] = color.green;
    shadow[offset + 2] = color.blue;
    shadow[offset + 3] = Math.round(data[offset + 3] * color.alpha);
  }
  return sharp(shadow, { raw: info }).png().toBuffer();
}

async function measureCharacterEdgeContrasts(sceneBuffer, characterBuffer, left, top, width, height) {
  const [scene, character] = await Promise.all([
    sharp(sceneBuffer).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(characterBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  const ratios = Object.fromEntries([
    ["standard", (value) => value],
    ...Object.entries(displayCalibrationProfiles).map(([id, profile]) => [id, profile.adjustLuminance])
  ].map(([id]) => [id, []]));
  const profiles = {
    standard: (value) => value,
    ...Object.fromEntries(Object.entries(displayCalibrationProfiles).map(([id, profile]) => [id, profile.adjustLuminance]))
  };
  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let y = 0; y < character.info.height; y += 1) {
    for (let x = 0; x < character.info.width; x += 1) {
      const offset = (y * character.info.width + x) * character.info.channels;
      if (character.data[offset + 3] < 96) continue;
      const outside = neighbors.flatMap(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= character.info.width || ny >= character.info.height) return [];
        const neighborOffset = (ny * character.info.width + nx) * character.info.channels;
        return character.data[neighborOffset + 3] < 32 ? [neighborOffset] : [];
      });
      if (outside.length === 0) continue;
      const edgeLuminance = relativeLuminance([scene.data[offset], scene.data[offset + 1], scene.data[offset + 2]]);
      const outsideLuminances = outside.map((neighborOffset) => relativeLuminance([
        scene.data[neighborOffset],
        scene.data[neighborOffset + 1],
        scene.data[neighborOffset + 2]
      ]));
      for (const [profileId, adjustLuminance] of Object.entries(profiles)) {
        const localRatios = outsideLuminances.map((outsideLuminance) => contrastRatio(
          adjustLuminance(edgeLuminance),
          adjustLuminance(outsideLuminance)
        ));
        ratios[profileId].push(Math.max(...localRatios));
      }
    }
  }
  if (ratios.standard.length === 0) throw new Error("Tone-audit character has no measurable edge pixels");
  return Object.fromEntries(Object.entries(ratios).map(([profileId, values]) => {
    values.sort((leftValue, rightValue) => leftValue - rightValue);
    return [profileId, values[Math.floor(values.length * 0.2)]];
  }));
}

export async function measureCompositedMapTone({ rootDir, zone, characters, defaultPresetId, edgeShadow }) {
  const mapRoot = path.join(rootDir, "client/public/assets/maps/v2", zone.id);
  const placements = DEFAULT_FOREGROUND_PLACEMENTS[zone.id] ?? [];
  const position = mapToneCharacterPositions[zone.id];
  if (!position) throw new Error(`Missing tone-audit character position for ${zone.id}`);
  const foregroundScene = await sharp(path.join(mapRoot, zone.background.output))
    .composite(placements.map((placement) => ({
      input: path.join(mapRoot, placement.asset),
      left: placement.x,
      top: placement.y
    })))
    .png()
    .toBuffer();
  const characterReports = [];
  const movementReports = [];
  for (const character of characters) {
    const characterLeft = Math.round(position.x - character.width / 2);
    const characterTop = Math.round(position.y - character.height / 2);
    const shadow = await characterShadow(character.buffer, edgeShadow);
    const scene = await sharp(foregroundScene).composite([
      { input: shadow, left: characterLeft + 1, top: characterTop + 2 },
      { input: character.buffer, left: characterLeft, top: characterTop }
    ]).png().toBuffer();
    const edgeContrasts = await measureCharacterEdgeContrasts(
      scene,
      character.buffer,
      characterLeft,
      characterTop,
      character.width,
      character.height
    );
    characterReports.push({
      presetId: character.presetId,
      scene,
      edgeContrast: edgeContrasts.standard,
      displayEdgeContrasts: edgeContrasts
    });
    for (const frame of character.movementFrames) {
      const frameShadow = await characterShadow(frame.buffer, edgeShadow);
      const frameScene = await sharp(foregroundScene).composite([
        { input: frameShadow, left: characterLeft + 1, top: characterTop + 2 },
        { input: frame.buffer, left: characterLeft, top: characterTop }
      ]).png().toBuffer();
      const edgeContrasts = await measureCharacterEdgeContrasts(
        frameScene,
        frame.buffer,
        characterLeft,
        characterTop,
        character.width,
        character.height
      );
      movementReports.push({
        presetId: character.presetId,
        frameId: frame.frameId,
        edgeContrast: edgeContrasts.standard,
        displayEdgeContrasts: edgeContrasts
      });
    }
  }
  const defaultReport = characterReports.find(({ presetId }) => presetId === defaultPresetId);
  if (!defaultReport) throw new Error("Default tone-audit character report is missing");
  const sceneTone = await measureMapTone(defaultReport.scene);
  const characterEdgeContrasts = Object.fromEntries(
    characterReports.map(({ presetId, edgeContrast }) => [presetId, edgeContrast])
  );
  const weakestCharacter = characterReports.reduce((weakest, report) => (
    report.edgeContrast < weakest.edgeContrast ? report : weakest
  ));
  const characterMovementEdgeContrasts = Object.fromEntries(characters.map((character) => [
    character.presetId,
    Object.fromEntries(movementReports
      .filter(({ presetId }) => presetId === character.presetId)
      .map(({ frameId, edgeContrast }) => [frameId, edgeContrast]))
  ]));
  const weakestMovementCharacter = movementReports.reduce((weakest, report) => (
    report.edgeContrast < weakest.edgeContrast ? report : weakest
  ));
  const displayProfiles = Object.fromEntries(Object.entries(displayCalibrationProfiles).map(([profileId, profile]) => {
    const characterEdgeContrasts = Object.fromEntries(characterReports.map((report) => [
      report.presetId,
      report.displayEdgeContrasts[profileId]
    ]));
    const characterMovementEdgeContrasts = Object.fromEntries(characters.map((character) => [
      character.presetId,
      Object.fromEntries(movementReports
        .filter(({ presetId }) => presetId === character.presetId)
        .map((report) => [report.frameId, report.displayEdgeContrasts[profileId]]))
    ]));
    const weakestCharacterEdgeContrast = Math.min(...Object.values(characterEdgeContrasts));
    const weakestMovementEdgeContrast = Math.min(
      ...Object.values(characterMovementEdgeContrasts).flatMap((frames) => Object.values(frames))
    );
    return [profileId, {
      label: profile.label,
      contrasts: calibratedLabelContrasts(sceneTone, profile.adjustLuminance),
      characterEdgeContrasts,
      characterMovementEdgeContrasts,
      weakestCharacterEdgeContrast,
      weakestMovementEdgeContrast
    }];
  }));
  return {
    sceneBuffer: defaultReport.scene,
    sceneAverageLuminance: sceneTone.averageLuminance,
    sceneP10Luminance: sceneTone.p10Luminance,
    sceneP90Luminance: sceneTone.p90Luminance,
    characterEdgeContrast: weakestCharacter.edgeContrast,
    characterEdgeContrasts,
    characterPresetCount: characterReports.length,
    weakestCharacterPresetId: weakestCharacter.presetId,
    characterMovementEdgeContrasts,
    movementFrameCount: characters[0]?.movementFrames.length ?? 0,
    weakestMovementCharacterPresetId: weakestMovementCharacter.presetId,
    weakestMovementFrameId: weakestMovementCharacter.frameId,
    weakestMovementEdgeContrast: weakestMovementCharacter.edgeContrast,
    displayProfiles,
    foregroundAssetCount: placements.length,
    characterPresetId: defaultPresetId,
    characterPosition: position
  };
}

export async function auditMapTones({ rootDir, contractPath = path.join(rootDir, "scripts/visual-baselines/map-tone-contract.json") }) {
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const mapRoot = path.join(rootDir, "client/public/assets/maps/v2");
  const manifest = JSON.parse(await readFile(path.join(rootDir, "map-assets/reference/v2/manifest.json"), "utf8"));
  const actualZoneIds = (await readdir(mapRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const expectedZoneIds = Object.keys(contract.zones).sort();
  const issues = [];
  if (JSON.stringify(actualZoneIds) !== JSON.stringify(expectedZoneIds)) issues.push("맵 톤 계약 구역 목록 불일치");

  const reports = [];
  const { characters, defaultPresetId } = await loadToneCharacters(rootDir);
  const edgeShadows = characterEdgeShadowsFromCss(
    await readFile(path.join(rootDir, "client/src/map-visual-enhancements.css"), "utf8"),
    expectedZoneIds
  );
  const typographyCss = await readFile(path.join(rootDir, "client/src/game-refined-theme.css"), "utf8");
  for (const [token, expectedWeight] of Object.entries(contract.displayTypography ?? {})) {
    const actualWeight = Number(typographyCss.match(new RegExp(`--${token}:\\s*(\\d+)`))?.[1]);
    if (actualWeight !== expectedWeight) issues.push(`표시 글꼴 토큰 --${token} 불일치`);
  }
  for (const zoneId of expectedZoneIds) {
    const zone = manifest.zones.find(({ id }) => id === zoneId);
    if (!zone) {
      issues.push(`${zoneId}: 맵 매니페스트 누락`);
      continue;
    }
    const backgroundTone = await measureMapTone(path.join(mapRoot, zoneId, zone.background.output));
    const compositeTone = await measureCompositedMapTone({
      rootDir,
      zone,
      characters,
      defaultPresetId,
      edgeShadow: edgeShadows[zoneId]
    });
    const { sceneBuffer: _sceneBuffer, ...sceneMetrics } = compositeTone;
    const metrics = { ...backgroundTone, ...sceneMetrics };
    const evaluation = evaluateMapToneMetrics(metrics, contract.zones[zoneId], contract.thresholds);
    evaluation.issues.forEach((issue) => issues.push(`${zoneId}: ${issue}`));
    reports.push({ zoneId, ...metrics, ...evaluation });
  }
  return { issues, reports, contractPath };
}
