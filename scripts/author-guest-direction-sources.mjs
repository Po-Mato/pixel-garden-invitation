import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const presetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));
const directions = ["down", "left", "right", "up"];
const sourceSize = { width: 192, height: 288 };
const targetFootBottom = 264;
const defaultOutputRoot = join(root, "character-assets/reference/guest-directions");

function projectPath(projectRoot, manifestPath) {
  return join(projectRoot, manifestPath);
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

async function transparentReferenceCrop(preset, projectRoot) {
  const { data, info } = await sharp(projectPath(projectRoot, preset.reference.image))
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

async function sampleHairColor(source) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const candidates = [];

  for (let y = 0; y < Math.min(info.height, 140); y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * 4;
      if (data[index + 3] < 160) continue;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const brightness = (red + green + blue) / 3;
      if (brightness >= 165) continue;
      candidates.push({ red, green, blue, brightness });
    }
  }

  if (candidates.length === 0) return "#2b211f";
  candidates.sort((a, b) => a.brightness - b.brightness);
  const selected = candidates[Math.floor(candidates.length * 0.45)];
  return hexColor([selected.red, selected.green, selected.blue]);
}

async function blankSource(composites) {
  return sharp({
    create: {
      width: sourceSize.width,
      height: sourceSize.height,
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

async function placeTrimmedSource(sprite, { leftShift = 0, topShift = 0 } = {}) {
  const metadata = await sharp(sprite).metadata();
  const left = Math.round((sourceSize.width - metadata.width) / 2) + leftShift;
  const top = targetFootBottom - metadata.height + 1 + topShift;
  return { input: sprite, left, top };
}

async function renderDownSource(preset, projectRoot) {
  const transparentCrop = await transparentReferenceCrop(preset, projectRoot);
  const metadata = await sharp(transparentCrop).metadata();
  const scaledHeight = Math.min(256, sourceSize.height);
  const scaledWidth = Math.round((metadata.width / metadata.height) * scaledHeight);
  const resized = await sharp(transparentCrop)
    .resize({
      width: Math.min(scaledWidth, sourceSize.width - 16),
      height: scaledHeight,
      fit: "inside",
      kernel: sharp.kernel.nearest,
      background: "#00000000"
    })
    .png()
    .toBuffer();

  return blankSource([await placeTrimmedSource(resized)]);
}

async function renderSideSource(frontSource, direction) {
  const trimmed = await trimTransparent(frontSource);
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
  const directionShift = direction === "left" ? -16 : 16;

  return blankSource([await placeTrimmedSource(profile, { leftShift: directionShift })]);
}

function backHairOverlay({ preset, hairColor }) {
  const stroke = shadeColor(hairColor, -28);
  const highlight = shadeColor(hairColor, 30);
  const longHair = preset.family === "feminine"
    ? `<path d="M70 78 C66 114 76 152 96 164 C116 152 126 114 122 78 Z" fill="${hairColor}" opacity="0.84"/>`
    : "";

  return Buffer.from(
    `<svg width="${sourceSize.width}" height="${sourceSize.height}" xmlns="http://www.w3.org/2000/svg">` +
      `${longHair}` +
      `<path d="M64 62 C64 34 78 20 96 18 C116 20 130 36 130 64 C130 92 118 112 96 114 C74 112 64 92 64 62 Z" fill="${hairColor}" stroke="${stroke}" stroke-width="4"/>` +
      `<path d="M74 50 C84 34 98 32 116 40" fill="none" stroke="${highlight}" stroke-width="4" opacity="0.45" stroke-linecap="round"/>` +
      `<path d="M72 74 C82 88 112 90 124 74" fill="none" stroke="${stroke}" stroke-width="4" opacity="0.42" stroke-linecap="round"/>` +
    `</svg>`
  );
}

async function renderUpSource(preset, frontSource) {
  const trimmed = await trimTransparent(frontSource);
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
  const hairColor = await sampleHairColor(frontSource);

  return blankSource([
    await placeTrimmedSource(backBody),
    { input: backHairOverlay({ preset, hairColor }), left: 0, top: 0 }
  ]);
}

async function renderDirectionSource(preset, direction, frontSource, projectRoot) {
  if (direction === "down") return frontSource ?? renderDownSource(preset, projectRoot);
  if (direction === "left" || direction === "right") return renderSideSource(frontSource, direction);
  if (direction === "up") return renderUpSource(preset, frontSource);
  throw new Error(`Unknown guest direction source: ${direction}`);
}

export async function authorGuestDirectionSources({
  outputRoot = defaultOutputRoot,
  catalog = presetCatalog,
  projectRoot = root
} = {}) {
  let count = 0;

  for (const preset of catalog.presets) {
    const frontSource = await renderDownSource(preset, projectRoot);
    for (const direction of directions) {
      const output = join(outputRoot, preset.id, `${direction}.png`);
      await mkdir(dirname(output), { recursive: true });
      await sharp(await renderDirectionSource(preset, direction, frontSource, projectRoot))
        .png({ compressionLevel: 9 })
        .toFile(output);
      count += 1;
    }
  }

  return count;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await authorGuestDirectionSources();
  console.log(`Authored ${count} guest direction source images`);
}
