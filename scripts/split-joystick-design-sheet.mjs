import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const alphaThreshold = 16;
const cropPadding = 8;

function findAlphaComponents(data, { width, height, channels }) {
  const visited = new Uint8Array(width * height);
  const components = [];

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || data[start * channels + 3] <= alphaThreshold) continue;

    const queue = [start];
    visited[start] = 1;
    let cursor = 0;
    let area = 0;
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;

    while (cursor < queue.length) {
      const index = queue[cursor];
      cursor += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);

      const neighbors = [];
      if (x > 0) neighbors.push(index - 1);
      if (x + 1 < width) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - width);
      if (y + 1 < height) neighbors.push(index + width);

      for (const neighbor of neighbors) {
        if (visited[neighbor] || data[neighbor * channels + 3] <= alphaThreshold) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    components.push({ area, left, right, top, bottom });
  }

  return components;
}

async function writeComponent(input, component, output, size) {
  const metadata = await sharp(input).metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;
  const left = Math.max(0, component.left - cropPadding);
  const top = Math.max(0, component.top - cropPadding);
  const right = Math.min(sourceWidth - 1, component.right + cropPadding);
  const bottom = Math.min(sourceHeight - 1, component.bottom + cropPadding);

  await mkdir(path.dirname(output), { recursive: true });
  await sharp(input)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.nearest
    })
    .png()
    .toFile(output);
}

export async function splitJoystickDesignSheet({ input, baseOutput, thumbOutput }) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const components = findAlphaComponents(data, info)
    .sort((left, right) => right.area - left.area)
    .slice(0, 2)
    .sort((left, right) => left.left - right.left);

  if (components.length !== 2) {
    throw new Error("joystick design sheet must contain two visible components");
  }

  await writeComponent(input, components[0], baseOutput, 180);
  await writeComponent(input, components[1], thumbOutput, 68);

  return {
    base: { width: 180, height: 180 },
    thumb: { width: 68, height: 68 }
  };
}

function readArgument(argumentsList, name) {
  const index = argumentsList.indexOf(name);
  const inline = argumentsList.find((argument) => argument.startsWith(`${name}=`));
  if (index !== -1) return argumentsList[index + 1];
  return inline?.slice(name.length + 1);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const argumentsList = process.argv.slice(2);
  const input = readArgument(argumentsList, "--input");
  const baseOutput = readArgument(argumentsList, "--base-output");
  const thumbOutput = readArgument(argumentsList, "--thumb-output");

  if (!input || !baseOutput || !thumbOutput) {
    throw new Error("--input, --base-output and --thumb-output are required");
  }

  await splitJoystickDesignSheet({ input, baseOutput, thumbOutput });
}
