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

function projectPath(projectRoot, manifestPath) {
  return join(projectRoot, manifestPath);
}

function directionSourcePath(preset, direction) {
  const manifestPath = preset.reference?.directions?.[direction];
  if (!manifestPath) {
    throw new Error(`${preset.id} must declare reference.directions.${direction}`);
  }
  return manifestPath;
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

async function transparentDirectionSource(preset, direction, projectRoot) {
  const { data, info } = await sharp(projectPath(projectRoot, directionSourcePath(preset, direction)))
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

async function pixelizeDirectionFrame(preset, direction, projectRoot) {
  const source = await transparentDirectionSource(preset, direction, projectRoot);
  const metadata = await sharp(source).metadata();
  const scaledHeight = Math.min(128, frame.height);
  const scaledWidth = Math.round((metadata.width / metadata.height) * scaledHeight);
  const resized = await sharp(source)
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

  return blankFrame([{ input: resized, left, top }]);
}

async function renderWalkStep(directionFrame, step) {
  return blankFrame([
    {
      input: directionFrame,
      left: walkStepShift[step] ?? 0,
      top: 0
    }
  ]);
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

export async function authorGuestPresetSources({
  sourceRoot = defaultSourceRoot,
  catalog = presetCatalog,
  projectRoot = root
} = {}) {
  let count = 0;

  for (const preset of catalog.presets) {
    const directionFrames = new Map();
    for (const direction of catalog.frame.walk.rows) {
      directionFrames.set(direction, await pixelizeDirectionFrame(preset, direction, projectRoot));
    }

    const walkComposites = [];
    for (let row = 0; row < catalog.frame.walk.rows.length; row += 1) {
      const direction = catalog.frame.walk.rows[row];
      const directionFrame = directionFrames.get(direction);
      for (let column = 0; column < catalog.frame.walk.columns; column += 1) {
        walkComposites.push({
          input: await renderWalkStep(directionFrame, column),
          left: column * frame.width,
          top: row * frame.height
        });
      }
    }

    await saveSheet(
      sourcePath(sourceRoot, preset.source.walk),
      walkComposites,
      catalog.frame.walk.sheet.width,
      catalog.frame.walk.sheet.height
    );
    count += 1;

    const idleFrame = directionFrames.get("down");
    await saveSheet(
      sourcePath(sourceRoot, preset.source.idle),
      Array.from({ length: catalog.frame.idle.columns }, (_, column) => ({
        input: idleFrame,
        left: column * frame.width,
        top: 0
      })),
      catalog.frame.idle.sheet.width,
      catalog.frame.idle.sheet.height
    );
    count += 1;
  }

  return count;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await authorGuestPresetSources();
  console.log(`Authored ${count} directional guest preset source sheets`);
}
