import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const presetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));
const defaultSourceRoot = join(root, "character-assets/source");
const frame = presetCatalog.frame.source;
const targetFootBottom = 132;
const walkStepShift = [-1, 0, 1];

function sourcePath(sourceRoot, manifestPath) {
  return join(sourceRoot, manifestPath.replace(/^character-assets\/source\//, ""));
}

function projectPath(manifestPath) {
  return join(root, manifestPath);
}

function isFloodFillBackgroundPixel(data, index) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const alpha = data[index + 3];
  if (alpha === 0) return true;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const chroma = max - min;

  return red >= 214 && green >= 196 && blue >= 160 && chroma <= 76;
}

function clearConnectedBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  const enqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pixel = y * width + x;
    if (visited[pixel]) return;
    const index = pixel * 4;
    if (!isFloodFillBackgroundPixel(data, index)) return;
    visited[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixel = queue[cursor];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    data[pixel * 4 + 3] = 0;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }
}

async function transparentReferenceCrop(preset) {
  if (!preset.reference?.image || !preset.reference?.crop) {
    throw new Error(`${preset.id} must declare an approved reference image crop`);
  }

  const { data, info } = await sharp(projectPath(preset.reference.image))
    .extract(preset.reference.crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  clearConnectedBackground(data, info.width, info.height);

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .trim({ background: "#00000000", threshold: 1 })
    .png()
    .toBuffer();
}

function hexColor([red, green, blue]) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function shadeColor(color, amount) {
  const numeric = Number.parseInt(color.slice(1), 16);
  const channels = [
    (numeric >> 16) & 255,
    (numeric >> 8) & 255,
    numeric & 255
  ].map((channel) => Math.max(0, Math.min(255, channel + amount)));
  return hexColor(channels);
}

async function sampleHairColor(frontFrame) {
  const { data, info } = await sharp(frontFrame)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const candidates = [];

  for (let y = 0; y < Math.min(info.height, 70); y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 160) continue;

      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const brightness = (red + green + blue) / 3;
      if (brightness >= 165) continue;
      candidates.push({ red, green, blue, brightness });
    }
  }

  if (candidates.length === 0) {
    return "#2b211f";
  }

  candidates.sort((a, b) => a.brightness - b.brightness);
  const selected = candidates[Math.floor(candidates.length * 0.45)];
  return hexColor([selected.red, selected.green, selected.blue]);
}

async function blankFrame(composites) {
  return sharp({
    create: {
      width: frame.width,
      height: frame.height,
      channels: 4,
      background: "#00000000"
    }
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function trimTransparent(buffer) {
  return sharp(buffer)
    .trim({ background: "#00000000", threshold: 1 })
    .png()
    .toBuffer();
}

async function placeTrimmedSprite(sprite, { leftShift = 0, topShift = 0 } = {}) {
  const metadata = await sharp(sprite).metadata();
  const left = Math.round((frame.width - metadata.width) / 2) + leftShift;
  const top = targetFootBottom - metadata.height + 1 + topShift;
  return { input: sprite, left, top };
}

function backHairOverlay({ preset, hairColor }) {
  const stroke = shadeColor(hairColor, -28);
  const highlight = shadeColor(hairColor, 30);
  const longHair = preset.family === "feminine"
    ? `<path d="M35 39 C33 57 38 76 48 82 C58 76 63 57 61 39 Z" fill="${hairColor}" opacity="0.84"/>`
    : "";

  return Buffer.from(
    `<svg width="${frame.width}" height="${frame.height}" xmlns="http://www.w3.org/2000/svg">` +
      `${longHair}` +
      `<path d="M32 31 C32 17 39 10 48 9 C58 10 65 18 65 32 C65 46 59 56 48 57 C37 56 32 46 32 31 Z" fill="${hairColor}" stroke="${stroke}" stroke-width="2"/>` +
      `<path d="M37 25 C42 17 49 16 58 20" fill="none" stroke="${highlight}" stroke-width="2" opacity="0.45" stroke-linecap="round"/>` +
      `<path d="M36 37 C41 44 56 45 62 37" fill="none" stroke="${stroke}" stroke-width="2" opacity="0.42" stroke-linecap="round"/>` +
    `</svg>`
  );
}

async function renderFrontFrame(preset) {
  const transparentCrop = await transparentReferenceCrop(preset);
  const metadata = await sharp(transparentCrop).metadata();
  const scaledHeight = Math.min(128, frame.height);
  const scaledWidth = Math.round((metadata.width / metadata.height) * scaledHeight);
  const resized = await sharp(transparentCrop)
    .resize({
      width: Math.min(scaledWidth, frame.width - 8),
      height: scaledHeight,
      fit: "inside",
      kernel: sharp.kernel.nearest,
      background: "#00000000"
    })
    .png()
    .toBuffer();
  const resizedMetadata = await sharp(resized).metadata();
  const left = Math.round((frame.width - resizedMetadata.width) / 2);
  const top = targetFootBottom - resizedMetadata.height + 1;

  return sharp({
    create: {
      width: frame.width,
      height: frame.height,
      channels: 4,
      background: "#00000000"
    }
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}

async function renderDownFrame(frontFrame, step) {
  const leftShift = walkStepShift[step] ?? 0;
  return blankFrame([
    {
      input: frontFrame,
      left: leftShift,
      top: 0
    }
  ]);
}

async function renderSideFrame(frontFrame, direction, step) {
  const trimmed = await trimTransparent(frontFrame);
  const metadata = await sharp(trimmed).metadata();
  const cropWidth = Math.max(1, Math.round(metadata.width * 0.58));
  const cropLeft = direction === "left" ? 0 : metadata.width - cropWidth;
  const profile = await sharp(trimmed)
    .extract({ left: cropLeft, top: 0, width: cropWidth, height: metadata.height })
    .resize({
      width: Math.max(1, Math.round(cropWidth * 0.96)),
      height: metadata.height,
      fit: "fill",
      kernel: sharp.kernel.nearest,
      background: "#00000000"
    })
    .png()
    .toBuffer();
  const directionShift = direction === "left" ? -8 : 8;
  const stepShift = walkStepShift[step] ?? 0;

  return blankFrame([
    await placeTrimmedSprite(profile, {
      leftShift: directionShift + stepShift,
      topShift: 0
    })
  ]);
}

async function renderUpFrame(preset, frontFrame, step) {
  const trimmed = await trimTransparent(frontFrame);
  const metadata = await sharp(trimmed).metadata();
  const backBody = await sharp(trimmed)
    .resize({
      width: Math.max(1, Math.round(metadata.width * 0.9)),
      height: metadata.height,
      fit: "fill",
      kernel: sharp.kernel.nearest,
      background: "#00000000"
    })
    .modulate({ brightness: 0.92, saturation: 0.9 })
    .png()
    .toBuffer();
  const bodyComposite = await placeTrimmedSprite(backBody, {
    leftShift: walkStepShift[step] ?? 0,
    topShift: 0
  });
  const hairColor = await sampleHairColor(frontFrame);

  return blankFrame([
    bodyComposite,
    { input: backHairOverlay({ preset, hairColor }), left: 0, top: 0 }
  ]);
}

async function renderWalkFrame(preset, frontFrame, { direction, step }) {
  if (direction === "down") {
    return renderDownFrame(frontFrame, step);
  }
  if (direction === "left" || direction === "right") {
    return renderSideFrame(frontFrame, direction, step);
  }
  if (direction === "up") {
    return renderUpFrame(preset, frontFrame, step);
  }
  throw new Error(`Unknown guest preset direction: ${direction}`);
}

async function saveSheet(output, frames, width, height) {
  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: "#00000000" }
  })
    .composite(frames)
    .png({ compressionLevel: 9 })
    .toFile(output);
}

export async function authorGuestPresetSources({ sourceRoot = defaultSourceRoot } = {}) {
  let count = 0;

  for (const preset of presetCatalog.presets) {
    const frontFrame = await renderFrontFrame(preset);
    const walkComposites = [];
    for (let row = 0; row < presetCatalog.frame.walk.rows.length; row += 1) {
      const direction = presetCatalog.frame.walk.rows[row];
      for (let column = 0; column < presetCatalog.frame.walk.columns; column += 1) {
        walkComposites.push({
          input: await renderWalkFrame(preset, frontFrame, { direction, step: column }),
          left: column * frame.width,
          top: row * frame.height
        });
      }
    }

    await saveSheet(
      sourcePath(sourceRoot, preset.source.walk),
      walkComposites,
      presetCatalog.frame.walk.sheet.width,
      presetCatalog.frame.walk.sheet.height
    );
    count += 1;

    await saveSheet(
      sourcePath(sourceRoot, preset.source.idle),
      Array.from({ length: presetCatalog.frame.idle.columns }, (_, column) => ({
        input: frontFrame,
        left: column * frame.width,
        top: 0
      })),
      presetCatalog.frame.idle.sheet.width,
      presetCatalog.frame.idle.sheet.height
    );
    count += 1;
  }

  return count;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await authorGuestPresetSources();
  console.log(`Authored ${count} approved-reference guest preset source sheets`);
}
