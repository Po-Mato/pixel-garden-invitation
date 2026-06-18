import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

const normalizeHex = (value) => value.toLowerCase().replace("#", "");

export async function validateDimensions(file, expected) {
  const metadata = await sharp(file).metadata();
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    throw new Error(
      `${file} must be ${expected.width}x${expected.height}; received ${metadata.width}x${metadata.height}`
    );
  }
}

export async function generateVariant(source, output, replacements, options = {}) {
  const image = sharp(source);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const palette = new Map(
    Object.entries(replacements).map(([from, to]) => [normalizeHex(from), normalizeHex(to)])
  );
  const allowedFixedColors = new Set(
    (options.allowedFixedColors ?? []).map(normalizeHex)
  );

  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue;
    const key = [data[offset], data[offset + 1], data[offset + 2]]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("");
    const replacement = palette.get(key);
    if (!replacement) {
      if (allowedFixedColors.has(key)) continue;
      throw new Error(`Unknown marker color #${key} in ${source}`);
    }
    data[offset] = Number.parseInt(replacement.slice(0, 2), 16);
    data[offset + 1] = Number.parseInt(replacement.slice(2, 4), 16);
    data[offset + 2] = Number.parseInt(replacement.slice(4, 6), 16);
  }

  await mkdir(dirname(output), { recursive: true });
  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(output);
}
