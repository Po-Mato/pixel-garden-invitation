import { createHash } from "node:crypto";
import sharp from "sharp";

function requireRgba(data, label) {
  if (data.length % 4 !== 0) {
    throw new Error(`${label} must contain complete RGBA pixels`);
  }
}

function requireImage(image, label) {
  if (
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width < 0 ||
    image.height < 0
  ) {
    throw new Error(`${label} must include valid width and height`);
  }
  requireRgba(image.data, `${label} data`);

  const expectedLength = image.width * image.height * 4;
  if (image.data.length !== expectedLength) {
    throw new Error(
      `${label} data length ${image.data.length} does not match ` +
        `${image.width}x${image.height} RGBA dimensions`
    );
  }
}

function requireSameDimensions(first, second, label) {
  requireImage(first, `${label} first image`);
  requireImage(second, `${label} second image`);

  if (first.width !== second.width || first.height !== second.height) {
    throw new Error(
      `${label} must have identical dimensions; received ` +
        `${first.width}x${first.height} and ${second.width}x${second.height}`
    );
  }
}

function rgbaKey(data, offset) {
  return `${data[offset]},${data[offset + 1]},${data[offset + 2]},${data[offset + 3]}`;
}

function pixelsDiffer(data, firstOffset, secondOffset) {
  const firstTransparent = data[firstOffset + 3] === 0;
  const secondTransparent = data[secondOffset + 3] === 0;

  if (firstTransparent || secondTransparent) {
    return firstTransparent !== secondTransparent;
  }

  return (
    data[firstOffset] !== data[secondOffset] ||
    data[firstOffset + 1] !== data[secondOffset + 1] ||
    data[firstOffset + 2] !== data[secondOffset + 2] ||
    data[firstOffset + 3] !== data[secondOffset + 3]
  );
}

export function silhouetteHash(data) {
  requireRgba(data, "Silhouette data");
  const occupancy = Buffer.alloc(data.length / 4);

  for (let offset = 0, pixel = 0; offset < data.length; offset += 4, pixel += 1) {
    occupancy[pixel] = data[offset + 3] === 0 ? 0 : 1;
  }

  return createHash("sha256").update(occupancy).digest("hex");
}

export function alphaDifference(first, second) {
  if (first.length !== second.length) {
    throw new Error("alphaDifference requires equal RGBA lengths");
  }
  requireRgba(first, "First alpha data");
  requireRgba(second, "Second alpha data");
  if (first.length === 0) return 0;

  let changed = 0;
  for (let offset = 0; offset < first.length; offset += 4) {
    if ((first[offset + 3] === 0) !== (second[offset + 3] === 0)) {
      changed += 1;
    }
  }

  return changed / (first.length / 4);
}

export async function rawRgba(file, imageFactory = sharp) {
  const { data, info } = await imageFactory(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    width: info.width,
    height: info.height,
    data: Buffer.from(data)
  };
}

export function combinedAlpha(layers) {
  if (layers.length === 0) {
    return { width: 0, height: 0, data: Buffer.alloc(0) };
  }

  const first = layers[0];
  requireImage(first, "Layer 1");
  for (let index = 1; index < layers.length; index += 1) {
    requireSameDimensions(first, layers[index], "Layers");
  }

  const data = Buffer.alloc(first.data.length);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset + 3] = layers.some((layer) => layer.data[offset + 3] !== 0) ? 255 : 0;
  }

  return { width: first.width, height: first.height, data };
}

export function collectStyleComparisonFailures(styles, minimumAlphaDifference) {
  const failures = [];

  for (let firstIndex = 0; firstIndex < styles.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < styles.length; secondIndex += 1) {
      const first = styles[firstIndex];
      const second = styles[secondIndex];
      if (first.family !== second.family) continue;

      try {
        requireSameDimensions(first.image, second.image, "Style images");
        const firstHash = silhouetteHash(first.image.data);
        const secondHash = silhouetteHash(second.image.data);

        if (firstHash === secondHash) {
          failures.push({
            files: first.files,
            message:
              `${first.id} duplicates the silhouette of ${second.id} ` +
              `within ${first.family}`
          });
        }

        const difference = alphaDifference(first.image.data, second.image.data);
        if (difference < minimumAlphaDifference) {
          failures.push({
            files: first.files,
            message:
              `${first.id} and ${second.id} alpha difference ${difference.toFixed(4)} ` +
              `is below ${minimumAlphaDifference} within ${first.family}`
          });
        }
      } catch (error) {
        failures.push({
          files: first.files,
          message:
            `${first.id} and ${second.id}: ` +
            (error instanceof Error ? error.message : String(error))
        });
      }
    }
  }

  return failures;
}

export async function inspectSheet(
  file,
  { frameWidth = 48, frameHeight = 72 } = {}
) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  if (width % frameWidth !== 0 || height % frameHeight !== 0) {
    throw new Error(
      `${width}x${height} dimensions must be divisible by ${frameWidth}x${frameHeight}`
    );
  }

  const source = Buffer.from(data);
  const sheetColors = new Set();
  for (let offset = 0; offset < source.length; offset += 4) {
    if (source[offset + 3] !== 0) {
      sheetColors.add(rgbaKey(source, offset));
    }
  }

  const columns = width / frameWidth;
  const rows = height / frameHeight;
  const frames = [];

  for (let frameRow = 0; frameRow < rows; frameRow += 1) {
    for (let frameColumn = 0; frameColumn < columns; frameColumn += 1) {
      const rgba = Buffer.alloc(frameWidth * frameHeight * 4);

      for (let y = 0; y < frameHeight; y += 1) {
        const sourceStart =
          ((frameRow * frameHeight + y) * width + frameColumn * frameWidth) * 4;
        const sourceEnd = sourceStart + frameWidth * 4;
        rgba.set(source.subarray(sourceStart, sourceEnd), y * frameWidth * 4);
      }

      let opaquePixels = 0;
      let colorTransitions = 0;
      let left = frameWidth;
      let top = frameHeight;
      let right = -1;
      let bottom = -1;
      const frameColors = new Set();

      for (let y = 0; y < frameHeight; y += 1) {
        for (let x = 0; x < frameWidth; x += 1) {
          const offset = (y * frameWidth + x) * 4;

          if (rgba[offset + 3] !== 0) {
            opaquePixels += 1;
            frameColors.add(rgbaKey(rgba, offset));
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }

          if (x + 1 < frameWidth && pixelsDiffer(rgba, offset, offset + 4)) {
            colorTransitions += 1;
          }
          if (
            y + 1 < frameHeight &&
            pixelsDiffer(rgba, offset, offset + frameWidth * 4)
          ) {
            colorTransitions += 1;
          }
        }
      }

      const bounds =
        opaquePixels === 0
          ? null
          : {
              left,
              top,
              right,
              bottom,
              width: right - left + 1,
              height: bottom - top + 1
            };

      frames.push({
        column: frameColumn,
        row: frameRow,
        opaquePixels,
        uniqueOpaqueColors: frameColors.size,
        colorTransitions,
        bounds,
        silhouetteHash: silhouetteHash(rgba),
        rgba
      });
    }
  }

  return {
    width,
    height,
    frameWidth,
    frameHeight,
    columns,
    rows,
    uniqueOpaqueColors: sheetColors.size,
    frames
  };
}
