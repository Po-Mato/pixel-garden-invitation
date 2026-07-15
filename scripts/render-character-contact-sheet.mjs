import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "shared/character-catalog.json"), "utf8"));
const guestPresetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));
const generatedRoot = join(root, "client/public/characters/generated");
const sheetBackground = "#f4efe7";
const directions = [
  { id: "down", row: 0 },
  { id: "left", row: 1 },
  { id: "right", row: 2 },
  { id: "up", row: 3 }
];
const guestFrame = guestPresetCatalog.frame.source;
const npcFrame = { width: 96, height: 144 };
const npcDisplayFrame = { width: 48, height: 72 };

export function parseArguments(arguments_) {
  let mode;
  let output;
  let outputSource;

  const assign = (name, value) => {
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    if (name === "mode") {
      if (mode !== undefined) throw new Error("Duplicate argument: --mode");
      mode = value;
      return;
    }
    if (output !== undefined) throw new Error("Duplicate argument: --output");
    output = value;
    outputSource = "option";
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--" && index === 0) {
      continue;
    }
    if (argument === "--mode" || argument === "--output") {
      const name = argument.slice(2);
      assign(name, arguments_[index + 1]);
      index += 1;
      continue;
    }
    if (argument.startsWith("--mode=")) {
      assign("mode", argument.slice("--mode=".length));
      continue;
    }
    if (argument.startsWith("--output=")) {
      assign("output", argument.slice("--output=".length));
      continue;
    }
    if (argument.startsWith("--")) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    if (output !== undefined) {
      if (outputSource === "option") throw new Error("Duplicate output argument");
      throw new Error(`Unexpected positional argument: ${argument}`);
    }
    output = argument;
    outputSource = "positional";
  }

  const resolvedMode = mode ?? "guest-presets";
  if (!new Set(["couple", "guest-presets", "guest-walk-review"]).has(resolvedMode)) {
    throw new Error(`Unknown contact-sheet mode: ${resolvedMode}`);
  }
  return {
    mode: resolvedMode,
    output: output ?? "/tmp/pixel-character-contact-sheet.png"
  };
}

export async function frame(relative, column, row, dimensions = guestFrame) {
  return sharp(join(generatedRoot, relative))
    .extract({
      left: column * dimensions.width,
      top: row * dimensions.height,
      width: dimensions.width,
      height: dimensions.height
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

export async function coupleSamples() {
  const samples = [];
  for (const npc of catalog.npcs) {
    samples.push({
      label: `${npc.id} / idle`,
      frames: [
        await frame(`npc/${npc.id}__idle.png`, 0, 0, npcFrame),
        await frame(`npc/${npc.id}__idle.png`, 1, 0, npcFrame)
      ]
    });
    for (const direction of directions) {
      samples.push({
        label: `${npc.id} / ${direction.id}`,
        frames: await Promise.all(
          [0, 1, 2].map((column) =>
            frame(`npc/${npc.id}__walk.png`, column, direction.row, npcFrame)
          )
        )
      });
    }
  }
  return samples;
}

export async function guestPresetSamples() {
  return guestPresetCatalog.presets.map((preset) => ({
    label: `${preset.id} / ${preset.label}`,
    frames: directions.map((direction) => ({
      direction: direction.id,
      relative: preset.generated.walk,
      column: 1,
      row: direction.row
    }))
  }));
}

export async function guestPresetWalkSamples() {
  return guestPresetCatalog.presets.flatMap((preset) =>
    directions.map((direction) => ({
      label: `${preset.id} / ${preset.label} / ${direction.id}`,
      presetId: preset.id,
      direction: direction.id,
      frames: [0, 1, 2].map((column) => ({
        step: `step-${String(column + 1).padStart(2, "0")}`,
        relative: preset.generated.walk,
        column,
        row: direction.row
      }))
    }))
  );
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
  const actualTopOffset = (spriteHeight - npcDisplayFrame.height) / 2;
  const enlargedChecker = await checkerboard(192, 288, 16);
  const actualChecker = await checkerboard(npcDisplayFrame.width, npcDisplayFrame.height, 4);
  const composites = [];

  for (let row = 0; row < samples.length; row += 1) {
    const sample = samples[row];
    const rowTop = margin + row * (rowHeight + rowGap);
    const spriteTop = rowTop + labelHeight + labelGap;
    composites.push({
      input: await label(`${sample.label} | 2x enlarged + display-size actual`, width - margin * 2),
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
      const actual = await sharp(sample.frames[index])
        .resize(npcDisplayFrame.width, npcDisplayFrame.height, { kernel: "nearest" })
        .png()
        .toBuffer();
      composites.push(
        { input: actualChecker, left: actualLeft, top: actualTop },
        { input: actual, left: actualLeft, top: actualTop }
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

async function renderCatalogFrame(sampleFrame) {
  const dimensions = sampleFrame.relative.startsWith("npc/") ? npcFrame : guestFrame;
  return frame(sampleFrame.relative, sampleFrame.column, sampleFrame.row, dimensions);
}

async function renderCatalogTile(sample, output, checker) {
  const tileWidth = 404;
  const tileHeight = 198;
  const composites = [];

  composites.push({
    input: await label(sample.label, tileWidth - 8),
    left: 4,
    top: 4
  });
  for (let frameIndex = 0; frameIndex < sample.frames.length; frameIndex += 1) {
    const sampleFrame = sample.frames[frameIndex];
    const frameLeft = 4 + frameIndex * 100;
    const scaled = await sharp(await renderCatalogFrame(sampleFrame))
      .resize(96, 144, { kernel: "nearest" })
      .png()
      .toBuffer();
    composites.push(
      {
        input: await label(sampleFrame.direction, 96),
        left: frameLeft,
        top: 28
      },
      { input: checker, left: frameLeft, top: 50 },
      { input: scaled, left: frameLeft, top: 50 }
    );
  }

  await sharp({
    create: {
      width: tileWidth,
      height: tileHeight,
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
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "character-contact-sheet-"));
  const previousConcurrency = sharp.concurrency();
  const rowPaths = [];

  sharp.concurrency(2);
  try {
    for (let row = 0; row < rows; row += 1) {
      const tilePaths = [];
      const rowComposites = [];
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        if (index >= samples.length) break;
        const tilePath = join(temporaryDirectory, `tile-${index}.png`);
        await renderCatalogTile(samples[index], tilePath, checker);
        tilePaths.push(tilePath);
        rowComposites.push({ input: tilePath, left: column * tileWidth, top: 0 });
      }

      const rowPath = join(temporaryDirectory, `row-${row}.png`);
      await sharp({
        create: {
          width: columns * tileWidth,
          height: tileHeight,
          channels: 4,
          background: sheetBackground
        }
      })
        .composite(rowComposites)
        .png({ compressionLevel: 9 })
        .toFile(rowPath);
      rowPaths.push(rowPath);
      await Promise.all(tilePaths.map((tilePath) => rm(tilePath)));
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
      .composite(rowPaths.map((rowPath, row) => ({
        input: rowPath,
        left: 0,
        top: row * tileHeight
      })))
      .png({ compressionLevel: 9 })
      .toFile(output);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
    sharp.concurrency(previousConcurrency);
  }
}

async function renderGuestWalkReviewTile(sample, output, sourceChecker, actualChecker) {
  const tileWidth = 452;
  const tileHeight = 198;
  const ratioGuide = Buffer.from(
    `<svg width="96" height="144" xmlns="http://www.w3.org/2000/svg">` +
      `<line x1="0" y1="48" x2="96" y2="48" stroke="#d1495b" stroke-opacity="0.72"/>` +
      `<line x1="0" y1="90" x2="96" y2="90" stroke="#2a9d8f" stroke-opacity="0.72"/>` +
    `</svg>`
  );
  const composites = [{
    input: await label(sample.label, tileWidth - 8),
    left: 4,
    top: 4
  }];

  for (let index = 0; index < sample.frames.length; index += 1) {
    const sampleFrame = sample.frames[index];
    const sourceLeft = 4 + index * 148;
    const source = await renderCatalogFrame(sampleFrame);
    const actual = await sharp(source)
      .resize(48, 72, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();

    composites.push(
      { input: await label(sampleFrame.step, 144), left: sourceLeft, top: 28 },
      { input: sourceChecker, left: sourceLeft, top: 50 },
      { input: source, left: sourceLeft, top: 50 },
      { input: ratioGuide, left: sourceLeft, top: 50 },
      { input: actualChecker, left: sourceLeft + 96, top: 86 },
      { input: actual, left: sourceLeft + 96, top: 86 }
    );
  }

  await sharp({
    create: {
      width: tileWidth,
      height: tileHeight,
      channels: 4,
      background: sheetBackground
    }
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function renderGuestWalkReview(samples, output) {
  const tileWidth = 452;
  const tileHeight = 198;
  const columns = 3;
  const rows = Math.ceil(samples.length / columns);
  const sourceChecker = await checkerboard(96, 144, 8);
  const actualChecker = await checkerboard(48, 72, 4);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "guest-walk-review-"));
  const composites = [];

  try {
    for (let index = 0; index < samples.length; index += 1) {
      const tilePath = join(temporaryDirectory, `tile-${index}.png`);
      await renderGuestWalkReviewTile(samples[index], tilePath, sourceChecker, actualChecker);
      composites.push({
        input: tilePath,
        left: (index % columns) * tileWidth,
        top: Math.floor(index / columns) * tileHeight
      });
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
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const { mode, output: outputArgument } = parseArguments(process.argv.slice(2));
  const output = resolve(outputArgument);

  const samples = mode === "couple"
    ? await coupleSamples()
    : mode === "guest-walk-review"
      ? await guestPresetWalkSamples()
      : await guestPresetSamples();
  if (mode === "couple") {
    await renderCouple(samples, output);
  } else if (mode === "guest-walk-review") {
    await renderGuestWalkReview(samples, output);
  } else {
    await renderCatalog(samples, output);
  }
  console.log(`Rendered ${samples.length} ${mode} samples to ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
