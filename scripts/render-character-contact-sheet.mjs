import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "shared/character-catalog.json"), "utf8"));
const generatedRoot = join(root, "client/public/characters/generated");
const sheetBackground = "#f4efe7";
const directions = [
  { id: "down", row: 0 },
  { id: "left", row: 1 },
  { id: "right", row: 2 },
  { id: "up", row: 3 }
];

const option = (name, fallback) =>
  process.argv.find((argument) => argument.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

export async function frame(relative, column, row) {
  return sharp(join(generatedRoot, relative))
    .extract({
      left: column * 48,
      top: row * 72,
      width: 48,
      height: 72
    })
    .png()
    .toBuffer();
}

export async function label(text, width) {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return Buffer.from(
    `<svg width="${width}" height="22" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#fffaf2"/>` +
      `<text x="6" y="15" font-family="Arial,sans-serif" font-size="12" fill="#241812">${escaped}</text>` +
    `</svg>`
  );
}

async function composeLayers(layers, column, row) {
  const buffers = await Promise.all(layers.map((layer) => frame(layer, column, row)));
  return sharp({
    create: { width: 48, height: 72, channels: 4, background: "#00000000" }
  })
    .composite(buffers.map((input) => ({ input })))
    .png()
    .toBuffer();
}

function defaultLayers(family, skinTone, hairStyle, hairColor, outfit, outfitPalette) {
  return [
    `hair/${hairStyle}__${hairColor}__back-walk.png`,
    `base/${family}__${skinTone}__walk.png`,
    `outfits/${outfit}__${outfitPalette}__walk.png`,
    `hair/${hairStyle}__${hairColor}__front-walk.png`
  ];
}

async function directionalFrames(layers) {
  return Promise.all(
    directions.map(async (direction) => ({
      direction: direction.id,
      image: await composeLayers(layers, 1, direction.row)
    }))
  );
}

export async function coupleSamples() {
  const samples = [];
  for (const npc of catalog.npcs) {
    samples.push({
      label: `${npc.id} / idle`,
      frames: [
        await frame(`npc/${npc.id}__idle.png`, 0, 0),
        await frame(`npc/${npc.id}__idle.png`, 1, 0)
      ]
    });
    for (const direction of directions) {
      samples.push({
        label: `${npc.id} / ${direction.id}`,
        frames: await Promise.all(
          [0, 1, 2].map((column) =>
            frame(`npc/${npc.id}__walk.png`, column, direction.row)
          )
        )
      });
    }
  }
  return samples;
}

export async function catalogSamples() {
  const samples = [];

  for (const hair of catalog.hairStyles) {
    const defaults = catalog.defaults[hair.family];
    for (const color of catalog.hairColors) {
      samples.push({
        label: `${hair.id} / ${color.id}`,
        frames: await directionalFrames(defaultLayers(
          hair.family,
          defaults.skinTone,
          hair.id,
          color.id,
          defaults.outfit,
          defaults.outfitPalette
        ))
      });
    }
  }

  for (const outfit of catalog.outfits) {
    const defaults = catalog.defaults[outfit.family];
    for (const palette of outfit.palettes) {
      samples.push({
        label: `${outfit.id} / ${palette}`,
        frames: await directionalFrames(defaultLayers(
          outfit.family,
          defaults.skinTone,
          defaults.hairStyle,
          defaults.hairColor,
          outfit.id,
          palette
        ))
      });
    }
  }

  for (const skin of catalog.skinTones) {
    const defaults = catalog.defaults.feminine;
    samples.push({
      label: `skin / ${skin.id}`,
      frames: [{
        direction: "down",
        image: await composeLayers(defaultLayers(
          "feminine",
          skin.id,
          defaults.hairStyle,
          defaults.hairColor,
          defaults.outfit,
          defaults.outfitPalette
        ), 1, 0)
      }]
    });
  }

  for (const accessory of catalog.accessories) {
    const defaults = catalog.defaults.feminine;
    const layers = defaultLayers(
      "feminine",
      defaults.skinTone,
      defaults.hairStyle,
      defaults.hairColor,
      defaults.outfit,
      defaults.outfitPalette
    );
    const accessoryLayer = `accessories/${accessory.id}__walk.png`;
    layers.splice(accessory.layer === "back-accessory" ? 0 : layers.length, 0, accessoryLayer);
    samples.push({
      label: `accessory / ${accessory.id}`,
      frames: [{
        direction: "down",
        image: await composeLayers(layers, 1, 0)
      }]
    });
  }

  for (const npc of catalog.npcs) {
    samples.push({
      label: `npc / ${npc.id}`,
      frames: [{
        direction: "idle",
        image: await frame(`npc/${npc.id}__idle.png`, 0, 0)
      }]
    });
  }

  return samples;
}

async function checkerboard(width, height, squareSize) {
  const light = [0xff, 0xfa, 0xf2, 0xff];
  const dark = [0xde, 0xd5, 0xc9, 0xff];
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0
        ? light
        : dark;
      const offset = (y * width + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }

  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function renderCouple(samples, output) {
  const width = 832;
  const margin = 24;
  const labelHeight = 22;
  const labelGap = 8;
  const spriteHeight = 288;
  const rowGap = 24;
  const rowHeight = labelHeight + labelGap + spriteHeight;
  const height = margin * 2 + samples.length * rowHeight + (samples.length - 1) * rowGap;
  const actualStart = 648;
  const actualTopOffset = (spriteHeight - 72) / 2;
  const enlargedChecker = await checkerboard(192, 288, 16);
  const actualChecker = await checkerboard(48, 72, 4);
  const composites = [];

  for (let row = 0; row < samples.length; row += 1) {
    const sample = samples[row];
    const rowTop = margin + row * (rowHeight + rowGap);
    const spriteTop = rowTop + labelHeight + labelGap;
    composites.push({
      input: await label(`${sample.label} | 4x enlarged + 1x actual`, width - margin * 2),
      left: margin,
      top: rowTop
    });

    for (let index = 0; index < sample.frames.length; index += 1) {
      const enlargedLeft = margin + index * 200;
      const enlarged = await sharp(sample.frames[index])
        .resize(192, 288, { kernel: "nearest" })
        .png()
        .toBuffer();
      composites.push(
        { input: enlargedChecker, left: enlargedLeft, top: spriteTop },
        { input: enlarged, left: enlargedLeft, top: spriteTop }
      );

      const actualLeft = actualStart + index * 56;
      const actualTop = spriteTop + actualTopOffset;
      composites.push(
        { input: actualChecker, left: actualLeft, top: actualTop },
        { input: sample.frames[index], left: actualLeft, top: actualTop }
      );
    }
  }

  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: sheetBackground
    }
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function renderCatalog(samples, output) {
  const tileWidth = 404;
  const tileHeight = 198;
  const columns = 3;
  const rows = Math.ceil(samples.length / columns);
  const checker = await checkerboard(96, 144, 8);
  const composites = [];

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const tileLeft = column * tileWidth;
    const tileTop = row * tileHeight;
    composites.push({
      input: await label(sample.label, tileWidth - 8),
      left: tileLeft + 4,
      top: tileTop + 4
    });

    for (let frameIndex = 0; frameIndex < sample.frames.length; frameIndex += 1) {
      const sampleFrame = sample.frames[frameIndex];
      const frameLeft = tileLeft + 4 + frameIndex * 100;
      const frameTop = tileTop + 50;
      const scaled = await sharp(sampleFrame.image)
        .resize(96, 144, { kernel: "nearest" })
        .png()
        .toBuffer();
      composites.push(
        {
          input: await label(sampleFrame.direction, 96),
          left: frameLeft,
          top: tileTop + 28
        },
        { input: checker, left: frameLeft, top: frameTop },
        { input: scaled, left: frameLeft, top: frameTop }
      );
    }
  }

  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 4,
      background: sheetBackground
    }
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function main() {
  const mode = option("mode", "catalog");
  const output = resolve(option("output", "/tmp/pixel-character-contact-sheet.png"));
  if (!new Set(["couple", "catalog"]).has(mode)) {
    throw new Error(`Unknown contact-sheet mode: ${mode}`);
  }

  const samples = mode === "couple" ? await coupleSamples() : await catalogSamples();
  if (mode === "couple") {
    await renderCouple(samples, output);
  } else {
    await renderCatalog(samples, output);
  }
  console.log(`Rendered ${samples.length} ${mode} samples to ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
