import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { DEFAULT_FOREGROUND_PLACEMENTS } from "./mapForegroundAuditRenderer.mjs";

const sheetWidth = 780;
const sectionHeaderHeight = 46;
const mapCellWidth = 390;
const mapPreviewHeight = 520;
const mapLabelHeight = 30;
const mapCellHeight = mapPreviewHeight + mapLabelHeight;
const characterCellWidth = 260;
const characterCellHeight = 154;
const directionRows = ["down", "left", "right", "up"];

function escapeXml(value) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    "\"": "&quot;"
  })[character]);
}

function textBar(text, width, height, { background = "#171b19", color = "#ffffff", size = 17 } = {}) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="${background}"/>` +
      `<text x="12" y="${Math.round(height * 0.68)}" font-family="Arial, sans-serif" font-size="${size}" fill="${color}">` +
      `${escapeXml(text)}</text></svg>`
  );
}

async function checkerboard(width, height, squareSize = 8) {
  const pixels = Buffer.alloc(width * height * 4);
  const colors = [[248, 248, 244, 255], [220, 226, 221, 255]];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = colors[(Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2];
      const offset = (y * width + x) * 4;
      pixels.set(color, offset);
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function renderMapCell(rootDir, zone) {
  const zoneDir = path.join(rootDir, "client/public/assets/maps/v2", zone.id);
  const backgroundPath = path.join(zoneDir, zone.background.output);
  const backgroundMetadata = await sharp(backgroundPath).metadata();
  if (backgroundMetadata.width !== zone.background.width || backgroundMetadata.height !== zone.background.height) {
    throw new Error(`${zone.id} background size mismatch`);
  }
  if (zone.background.width < mapCellWidth || zone.background.height < mapPreviewHeight) {
    throw new Error(`${zone.id} background is smaller than the mobile audit viewport`);
  }

  const placements = DEFAULT_FOREGROUND_PLACEMENTS[zone.id] ?? [];
  const declared = new Set(zone.overlays.map((overlay) => overlay.output));
  placements.forEach(({ asset }) => {
    if (!declared.has(asset)) throw new Error(`${zone.id} undeclared foreground: ${asset}`);
  });

  const left = Math.floor((zone.background.width - mapCellWidth) / 2);
  const top = Math.floor((zone.background.height - mapPreviewHeight) / 2);
  const composedMap = await sharp(backgroundPath)
    .composite(placements.map((placement) => ({
      input: path.join(zoneDir, placement.asset),
      left: placement.x,
      top: placement.y
    })))
    .png()
    .toBuffer();
  const preview = await sharp(composedMap)
    .extract({ left, top, width: mapCellWidth, height: mapPreviewHeight })
    .png()
    .toBuffer();

  return sharp({
    create: { width: mapCellWidth, height: mapCellHeight, channels: 4, background: "#171b19" }
  }).composite([
    { input: textBar(zone.id, mapCellWidth, mapLabelHeight, { size: 15 }), left: 0, top: 0 },
    { input: preview, left: 0, top: mapLabelHeight }
  ]).png().toBuffer();
}

async function renderCharacterCell(rootDir, preset, frameContract, checker) {
  const walkPath = path.join(rootDir, "client/public/characters/generated", preset.generated.walk);
  const metadata = await sharp(walkPath).metadata();
  const expectedWidth = frameContract.walk.sheet.width;
  const expectedHeight = frameContract.walk.sheet.height;
  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    throw new Error(`${preset.id} walk sheet size mismatch`);
  }

  const frameWidth = frameContract.source.width;
  const frameHeight = frameContract.source.height;
  const displayWidth = 60;
  const displayHeight = 90;
  const spriteTop = 52;
  const composites = [
    { input: textBar(preset.label, characterCellWidth, 30, { background: "#f5f7f5", color: "#26362f", size: 13 }), left: 0, top: 0 },
    { input: checker, left: 8, top: 38 }
  ];

  for (const [row, direction] of directionRows.entries()) {
    const frame = await sharp(walkPath)
      .extract({
        left: frameWidth,
        top: row * frameHeight,
        width: frameWidth,
        height: frameHeight
      })
      .resize(displayWidth, displayHeight, { kernel: sharp.kernel.nearest })
      .png()
      .toBuffer();
    const left = 8 + row * 62;
    composites.push(
      { input: frame, left, top: spriteTop },
      { input: textBar(direction, displayWidth, 14, { background: "#00000000", color: "#3d554a", size: 10 }), left, top: 35 }
    );
  }

  return sharp({
    create: { width: characterCellWidth, height: characterCellHeight, channels: 4, background: "#f5f7f5" }
  }).composite(composites).png().toBuffer();
}

export async function renderMobileGameVisualAudit({ rootDir, outputPath }) {
  const mapManifest = JSON.parse(await readFile(path.join(rootDir, "map-assets/reference/v2/manifest.json"), "utf8"));
  const characterManifest = JSON.parse(await readFile(path.join(rootDir, "character-assets/guest-character-presets.json"), "utf8"));
  const mapRows = Math.ceil(mapManifest.zones.length / 2);
  const characterRows = Math.ceil(characterManifest.presets.length / 3);
  const mapSectionTop = sectionHeaderHeight;
  const characterHeaderTop = mapSectionTop + mapRows * mapCellHeight;
  const characterSectionTop = characterHeaderTop + sectionHeaderHeight;
  const outputHeight = characterSectionTop + characterRows * characterCellHeight;
  const composites = [
    { input: textBar("MOBILE MAP REGRESSION / 390 x 520", sheetWidth, sectionHeaderHeight), left: 0, top: 0 },
    { input: textBar("GUEST DIRECTION REGRESSION / IN-GAME SCALE", sheetWidth, sectionHeaderHeight), left: 0, top: characterHeaderTop }
  ];

  for (const [index, zone] of mapManifest.zones.entries()) {
    composites.push({
      input: await renderMapCell(rootDir, zone),
      left: (index % 2) * mapCellWidth,
      top: mapSectionTop + Math.floor(index / 2) * mapCellHeight
    });
  }

  const checker = await checkerboard(244, 108);
  for (const [index, preset] of characterManifest.presets.entries()) {
    composites.push({
      input: await renderCharacterCell(rootDir, preset, characterManifest.frame, checker),
      left: (index % 3) * characterCellWidth,
      top: characterSectionTop + Math.floor(index / 3) * characterCellHeight
    });
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({
    create: { width: sheetWidth, height: outputHeight, channels: 4, background: "#111411" }
  }).composite(composites).png().toFile(outputPath);

  return {
    mapZoneIds: mapManifest.zones.map((zone) => zone.id),
    characterPresetIds: characterManifest.presets.map((preset) => preset.id),
    directionSampleCount: characterManifest.presets.length * directionRows.length,
    outputWidth: sheetWidth,
    outputHeight,
    outputPath
  };
}
