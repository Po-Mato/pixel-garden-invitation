import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const presetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));
const defaultSourceRoot = join(root, "character-assets/source");
const defaultWalkSourceRoot = "character-assets/reference/guest-walk-direction-sources/v1";
const frame = presetCatalog.frame.source;
const targetFootBottom = 132;
const walkStepShift = [-1, 0, 1];
const minimumFrameWidthByDirection = {
  down: 46,
  left: 30,
  right: 30,
  up: 46
};

function sourcePath(sourceRoot, manifestPath) {
  return join(sourceRoot, manifestPath.replace(/^character-assets\/source\//, ""));
}

function projectPath(projectRoot, manifestPath) {
  if (isAbsolute(manifestPath)) return manifestPath;
  return join(projectRoot, manifestPath);
}

function directionSourcePath(preset, direction) {
  const manifestPath = preset.reference?.directions?.[direction];
  if (!manifestPath) {
    throw new Error(`${preset.id} must declare reference.directions.${direction}`);
  }
  return manifestPath;
}

function walkSourceGuest(preset, presetIndex) {
  return preset.reference?.walkSourceGuest ?? `guest-${String(presetIndex + 1).padStart(2, "0")}`;
}

function walkStepSourcePath(projectRoot, walkSourceRoot, preset, presetIndex, direction, step) {
  return join(
    projectPath(projectRoot, walkSourceRoot),
    walkSourceGuest(preset, presetIndex),
    direction,
    `step-${String(step + 1).padStart(2, "0")}-source.png`
  );
}

async function pathExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
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

  return red >= 235 && green >= 235 && blue >= 235 && chroma <= 24;
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

function clearEnclosedHairBackground(data, width, height) {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (data[pixel * 4 + 3] === 0) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }

  if (right < left || bottom < top) return;

  const opaqueWidth = right - left + 1;
  const opaqueHeight = bottom - top + 1;
  const headBottom = top + Math.floor(opaqueHeight * 0.44);
  const longHairBottom = top + Math.floor(opaqueHeight * 0.58);
  const outerLeft = left + Math.floor(opaqueWidth * 0.32);
  const outerRight = right - Math.floor(opaqueWidth * 0.32);
  const visited = new Uint8Array(width * height);

  const isOpaquePaleNeutral = (pixel) => {
    const index = pixel * 4;
    if (data[index + 3] === 0) return false;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    return min >= 210 && max - min <= 32;
  };

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || !isOpaquePaleNeutral(start)) continue;

    visited[start] = 1;
    const queue = [start];
    let minX = width;
    let maxX = -1;
    let maxY = -1;
    let pureWhitePixels = 0;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixel = queue[cursor];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const index = pixel * 4;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (data[index] >= 250 && data[index + 1] >= 250 && data[index + 2] >= 250) {
        pureWhitePixels += 1;
      }

      for (const [nextX, nextY] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ]) {
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const nextPixel = nextY * width + nextX;
        if (visited[nextPixel] || !isOpaquePaleNeutral(nextPixel)) continue;
        visited[nextPixel] = 1;
        queue.push(nextPixel);
      }
    }

    if (queue.length > 48) continue;

    const members = new Set(queue);
    let boundaryPixels = 0;
    let darkBoundaryPixels = 0;
    let skinBoundaryPixels = 0;
    let transparentBoundaryPixels = 0;

    for (const pixel of queue) {
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      for (const [nextX, nextY] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ]) {
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const nextPixel = nextY * width + nextX;
        if (members.has(nextPixel)) continue;
        const index = nextPixel * 4;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const alpha = data[index + 3];
        boundaryPixels += 1;
        if (alpha === 0) {
          transparentBoundaryPixels += 1;
          continue;
        }

        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        if (luminance < 150) darkBoundaryPixels += 1;
        if (red > green + 8 && green > blue + 4 && red > 180) skinBoundaryPixels += 1;
      }
    }

    const inOuterHair = maxX <= outerLeft || minX >= outerRight;
    const inHairHeight = maxY <= headBottom || (inOuterHair && maxY <= longHairBottom);
    const opaqueBoundaryPixels = boundaryPixels - transparentBoundaryPixels;
    const isHairGap =
      inHairHeight &&
      (pureWhitePixels > 0 || transparentBoundaryPixels > 0) &&
      skinBoundaryPixels === 0 &&
      opaqueBoundaryPixels > 0 &&
      darkBoundaryPixels / opaqueBoundaryPixels >= 0.5;

    if (!isHairGap) continue;
    for (const pixel of queue) {
      data.fill(0, pixel * 4, pixel * 4 + 4);
    }
  }
}

async function clearPixelFrameHairBackground(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  clearEnclosedHairBackground(data, info.width, info.height);

  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    if (data[pixel * 4 + 3] === 0) continue;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }

  const cleaned = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  });
  const opaqueHeight = bottom - top + 1;
  if (opaqueHeight >= 127 || right < left) return cleaned.png().toBuffer();

  const opaqueWidth = right - left + 1;
  const normalizedWidth = Math.round((opaqueWidth / opaqueHeight) * 127);
  const normalized = await cleaned
    .extract({ left, top, width: opaqueWidth, height: opaqueHeight })
    .resize({ width: normalizedWidth, height: 127, fit: "fill", kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
  return blankFrame([
    {
      input: normalized,
      left: Math.round((frame.width - normalizedWidth) / 2),
      top: targetFootBottom - 126
    }
  ]);
}

async function transparentSource(input) {
  const { data, info } = await sharp(input)
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

async function transparentDirectionSource(preset, direction, projectRoot) {
  return transparentSource(projectPath(projectRoot, directionSourcePath(preset, direction)));
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

async function pixelizeTransparentSource(source, { minimumWidth = 0 } = {}) {
  const metadata = await sharp(source).metadata();
  const scaledHeight = Math.min(128, frame.height);
  const scaledWidth = Math.round((metadata.width / metadata.height) * scaledHeight);
  const targetWidth = Math.min(frame.width - 8, scaledWidth);
  const resized = await sharp(source)
    .resize({
      width: targetWidth,
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

  return clearPixelFrameHairBackground(await blankFrame([{ input: resized, left, top }]));
}

async function pixelizeDirectionFrame(preset, direction, projectRoot) {
  return pixelizeTransparentSource(await transparentDirectionSource(preset, direction, projectRoot), {
    minimumWidth: minimumFrameWidthByDirection[direction] ?? 0
  });
}

async function pixelizeWalkStepFrame(preset, presetIndex, direction, step, projectRoot, walkSourceRoot) {
  const stepSource = walkStepSourcePath(
    projectRoot,
    walkSourceRoot,
    preset,
    presetIndex,
    direction,
    step
  );
  if (!(await pathExists(stepSource))) return null;
  return pixelizeTransparentSource(await transparentSource(stepSource), {
    minimumWidth: minimumFrameWidthByDirection[direction] ?? 0
  });
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
  projectRoot = root,
  walkSourceRoot = defaultWalkSourceRoot
} = {}) {
  let count = 0;

  for (let presetIndex = 0; presetIndex < catalog.presets.length; presetIndex += 1) {
    const preset = catalog.presets[presetIndex];
    const directionFrames = new Map();
    for (const direction of catalog.frame.walk.rows) {
      directionFrames.set(direction, await pixelizeDirectionFrame(preset, direction, projectRoot));
    }

    const walkFrames = new Map();
    for (const direction of catalog.frame.walk.rows) {
      const directionFrame = directionFrames.get(direction);
      const frames = [];
      for (let column = 0; column < catalog.frame.walk.columns; column += 1) {
        frames.push(
          (await pixelizeWalkStepFrame(
            preset,
            presetIndex,
            direction,
            column,
            projectRoot,
            walkSourceRoot
          )) ?? (await renderWalkStep(directionFrame, column))
        );
      }
      walkFrames.set(direction, frames);
    }

    const walkComposites = [];
    for (let row = 0; row < catalog.frame.walk.rows.length; row += 1) {
      const direction = catalog.frame.walk.rows[row];
      for (let column = 0; column < catalog.frame.walk.columns; column += 1) {
        walkComposites.push({
          input: walkFrames.get(direction)[column],
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

    const idleFrame = walkFrames.get("down")?.[1] ?? directionFrames.get("down");
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
