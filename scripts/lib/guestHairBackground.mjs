import sharp from "sharp";

export const waveHairPresetIds = new Set([
  "feminine-long-wave-dress",
  "feminine-lavender-jacket-dress",
  "feminine-teal-modern-hanbok"
]);

export function clearEnclosedHairBackground(data, width, height) {
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
  const maximumHairGapPixels = Math.max(96, Math.round(opaqueWidth * opaqueHeight * 0.02));
  const visited = new Uint8Array(width * height);

  const isOpaquePaleNeutral = (pixel) => {
    const index = pixel * 4;
    if (data[index + 3] === 0) return false;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    return min >= 190 && max - min <= 32;
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

    if (queue.length > maximumHairGapPixels) continue;

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

export async function cleanGuestHairSheet(input, frame) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width % frame.width !== 0 || info.height % frame.height !== 0) {
    throw new Error(
      `Guest sheet ${info.width}x${info.height} must be divisible by ${frame.width}x${frame.height}`
    );
  }

  const frameData = Buffer.alloc(frame.width * frame.height * 4);
  const columns = info.width / frame.width;
  const rows = info.height / frame.height;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      for (let y = 0; y < frame.height; y += 1) {
        const sheetStart = (((row * frame.height + y) * info.width) + column * frame.width) * 4;
        data.copy(
          frameData,
          y * frame.width * 4,
          sheetStart,
          sheetStart + frame.width * 4
        );
      }

      clearEnclosedHairBackground(frameData, frame.width, frame.height);

      for (let y = 0; y < frame.height; y += 1) {
        const sheetStart = (((row * frame.height + y) * info.width) + column * frame.width) * 4;
        frameData.copy(
          data,
          sheetStart,
          y * frame.width * 4,
          (y + 1) * frame.width * 4
        );
      }
    }
  }

  return sharp(data, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
}
