export const characterVisualAnchorAlphaThreshold = 16;

function finiteDimension(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return number;
}

export function measureAlphaVisualAnchor(
  data,
  {
    width,
    height,
    channels = 4,
    alphaThreshold = characterVisualAnchorAlphaThreshold
  }
) {
  const frameWidth = finiteDimension(width, "width");
  const frameHeight = finiteDimension(height, "height");
  const channelCount = finiteDimension(channels, "channels");
  if (channelCount < 2) throw new TypeError("channels must include an alpha channel");
  if (!data || data.length < frameWidth * frameHeight * channelCount) {
    throw new TypeError("RGBA data is smaller than the declared frame");
  }

  const alphaChannel = channelCount - 1;
  let left = frameWidth;
  let top = frameHeight;
  let right = -1;
  let bottom = -1;
  let opaquePixelCount = 0;
  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const alpha = data[(y * frameWidth + x) * channelCount + alphaChannel];
      if (alpha <= alphaThreshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      opaquePixelCount += 1;
    }
  }
  if (opaquePixelCount === 0) throw new Error("Character frame has no visible alpha pixels");

  return {
    centerX: (left + right + 1) / 2,
    centerY: (top + bottom + 1) / 2,
    feetY: bottom + 1,
    bounds: {
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1
    },
    opaquePixelCount
  };
}
