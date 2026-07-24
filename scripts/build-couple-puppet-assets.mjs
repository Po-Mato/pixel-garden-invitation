import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = path.join(rootDir, "character-assets/reference/couple-puppet-sources/v1");
const sourceRoot = path.join(rootDir, "character-assets/source/couple-puppets");
const publicRoot = path.join(rootDir, "client/public/characters/puppets");

export const couplePuppetLayout = {
  canvas: { width: 512, height: 768 },
  character: { top: 24, headHeight: 240, bodyVisibleHeight: 480, overlap: 16 },
  characters: {
    groom: {
      source: path.join(referenceRoot, "groom/groom-front-transparent.png"),
      roleLabel: "신랑",
      headCrop: { left: 390, top: 111, width: 454, height: 396 },
      bodyCrop: { left: 390, top: 486, width: 454, height: 688 },
      blink: {
        skin: "#f3bea1",
        stroke: "#4a281e",
        eyes: [{ x: 218, y: 190 }, { x: 295, y: 190 }]
      },
      motion: { headDegrees: 1.25, headLift: 2.2, breathScale: 0.008, phase: 0 }
    },
    bride: {
      source: path.join(referenceRoot, "bride/bride-front-transparent.png"),
      roleLabel: "신부",
      headCrop: { left: 300, top: 203, width: 424, height: 349 },
      bodyCrop: { left: 196, top: 515, width: 644, height: 850 },
      blink: {
        skin: "#f5c5a7",
        stroke: "#5a3022",
        eyes: [{ x: 227, y: 179 }, { x: 294, y: 179 }]
      },
      motion: { headDegrees: 1.1, headLift: 1.8, breathScale: 0.007, phase: 1.7 }
    }
  }
};

function transparentCanvas(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });
}

async function renderLayer(source, crop, targetHeight, top) {
  const resized = await sharp(source)
    .extract(crop)
    .resize({ height: targetHeight, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
  const metadata = await sharp(resized).metadata();
  const left = Math.round((couplePuppetLayout.canvas.width - (metadata.width ?? 0)) / 2);

  return transparentCanvas(couplePuppetLayout.canvas.width, couplePuppetLayout.canvas.height)
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}

async function featherLayerBottom(buffer, bottom, feather = 18) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const start = bottom - feather;
  for (let y = Math.max(0, start); y < Math.min(info.height, bottom); y += 1) {
    const factor = Math.max(0, Math.min(1, (bottom - y - 1) / feather));
    for (let x = 0; x < info.width; x += 1) {
      const alphaIndex = (y * info.width + x) * info.channels + 3;
      data[alphaIndex] = Math.round(data[alphaIndex] * factor);
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

function blinkOverlay({ skin, stroke, eyes }) {
  const eyeMarkup = eyes.map(({ x, y }) => `
    <ellipse cx="${x}" cy="${y}" rx="19" ry="13" fill="${skin}"/>
    <path d="M ${x - 13} ${y + 1} Q ${x} ${y + 9} ${x + 13} ${y + 1}"
      fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round"/>
  `).join("");

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="768" viewBox="0 0 512 768">
      ${eyeMarkup}
    </svg>
  `);
}

async function writeWebp(buffer, outputPath, quality = 94) {
  await sharp(buffer).webp({ quality, alphaQuality: 100, smartSubsample: true }).toFile(outputPath);
}

export async function buildCouplePuppetAssets(characterId) {
  const config = couplePuppetLayout.characters[characterId];
  if (!config) throw new Error(`알 수 없는 커플 퍼펫: ${characterId}`);

  const sourceOut = path.join(sourceRoot, characterId);
  const publicOut = path.join(publicRoot, characterId);
  await Promise.all([mkdir(sourceOut, { recursive: true }), mkdir(publicOut, { recursive: true })]);

  const bodyTop = couplePuppetLayout.character.top
    + couplePuppetLayout.character.headHeight
    - couplePuppetLayout.character.overlap;
  const bodyLayerHeight = couplePuppetLayout.character.bodyVisibleHeight
    + couplePuppetLayout.character.overlap;
  const headBase = await renderLayer(
    config.source,
    config.headCrop,
    couplePuppetLayout.character.headHeight,
    couplePuppetLayout.character.top
  );
  const head = await featherLayerBottom(
    headBase,
    couplePuppetLayout.character.top + couplePuppetLayout.character.headHeight
  );
  const body = await renderLayer(
    config.source,
    config.bodyCrop,
    bodyLayerHeight,
    bodyTop
  );
  const headBlink = await sharp(head)
    .composite([{ input: blinkOverlay(config.blink), left: 0, top: 0 }])
    .png()
    .toBuffer();
  const preview = await transparentCanvas(512, 768)
    .composite([
      { input: body, left: 0, top: 0 },
      { input: head, left: 0, top: 0 }
    ])
    .png()
    .toBuffer();

  await Promise.all([
    sharp(body).png().toFile(path.join(sourceOut, "body.png")),
    sharp(head).png().toFile(path.join(sourceOut, "head-open.png")),
    sharp(headBlink).png().toFile(path.join(sourceOut, "head-blink.png")),
    sharp(preview).png().toFile(path.join(sourceOut, "preview.png")),
    writeWebp(body, path.join(publicOut, "body.webp")),
    writeWebp(head, path.join(publicOut, "head-open.webp")),
    writeWebp(headBlink, path.join(publicOut, "head-blink.webp")),
    writeWebp(preview, path.join(publicOut, "preview.webp"))
  ]);

  const manifest = {
    version: 1,
    characterId,
    roleLabel: config.roleLabel,
    license: { runtime: "PixiJS", spdx: "MIT" },
    canvas: couplePuppetLayout.canvas,
    layers: {
      body: "body.webp",
      headOpen: "head-open.webp",
      headBlink: "head-blink.webp",
      preview: "preview.webp"
    },
    bones: {
      root: { x: 256, y: 736 },
      head: { x: 256, y: bodyTop + 4 }
    },
    motion: {
      ...config.motion,
      blinkEveryMs: [3100, 5200],
      blinkDurationMs: 135
    }
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await Promise.all([
    writeFile(path.join(sourceOut, "rig.json"), manifestText),
    writeFile(path.join(publicOut, "rig.json"), manifestText)
  ]);

  return manifest;
}

export async function buildAllCouplePuppetAssets() {
  for (const characterId of Object.keys(couplePuppetLayout.characters)) {
    await buildCouplePuppetAssets(characterId);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildAllCouplePuppetAssets();
  console.log("신랑·신부 2D 퍼펫 자산 생성을 완료했습니다.");
}
