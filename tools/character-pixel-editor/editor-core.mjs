export function frameOffset(column, row, frameWidth = 48, frameHeight = 72) {
  return { x: column * frameWidth, y: row * frameHeight };
}

export function clonePixels(pixels) {
  return new Uint8ClampedArray(pixels);
}

export function applyPixel(pixels, imageWidth, x, y, rgba) {
  const offset = (y * imageWidth + x) * 4;
  const previous = [...pixels.slice(offset, offset + 4)];
  pixels.set(rgba, offset);
  return { offset, previous };
}

export function restorePixel(pixels, change) {
  pixels.set(change.previous, change.offset);
}

export function mirrorFrameHorizontally(pixels, imageWidth, imageHeight, frame) {
  if (
    frame.x < 0 ||
    frame.y < 0 ||
    frame.x + frame.width > imageWidth ||
    frame.y + frame.height > imageHeight
  ) {
    throw new Error("Frame is outside the loaded image");
  }

  for (let row = 0; row < frame.height; row += 1) {
    for (let column = 0; column < Math.floor(frame.width / 2); column += 1) {
      const left = ((frame.y + row) * imageWidth + frame.x + column) * 4;
      const right = (
        (frame.y + row) * imageWidth +
        frame.x +
        frame.width -
        column -
        1
      ) * 4;
      const leftPixel = pixels.slice(left, left + 4);
      const rightPixel = pixels.slice(right, right + 4);
      pixels.set(rightPixel, left);
      pixels.set(leftPixel, right);
    }
  }
}
