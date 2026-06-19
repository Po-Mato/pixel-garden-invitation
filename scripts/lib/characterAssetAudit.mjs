import { createHash } from "node:crypto";
import sharp from "sharp";

function requireRgba(data, label) {
  if (data.length % 4 !== 0) {
    throw new Error(`${label} must contain complete RGBA pixels`);
  }
}

function rgbaKey(data, offset) {
  return `${data[offset]},${data[offset + 1]},${data[offset + 2]},${data[offset + 3]}`;
}

function pixelsDiffer(data, firstOffset, secondOffset) {
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
