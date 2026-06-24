import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const presetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));
const defaultSourceRoot = join(root, "character-assets/source");
const frame = presetCatalog.frame.source;
const targetFootBottom = 132;

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

async function renderFrame(preset) {
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
    const framePng = await renderFrame(preset);
    const walkComposites = [];
    for (let row = 0; row < presetCatalog.frame.walk.rows.length; row += 1) {
      for (let column = 0; column < presetCatalog.frame.walk.columns; column += 1) {
        walkComposites.push({
          input: framePng,
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
        input: framePng,
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
