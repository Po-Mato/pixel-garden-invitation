import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "shared/character-catalog.json"), "utf8"));
const generatedRoot = join(root, "client/public/characters/generated");
const output = resolve(process.argv[2] ?? "/tmp/pixel-character-contact-sheet.png");
const tileWidth = 104;
const tileHeight = 152;
const columns = 12;

async function walkFrame(relative) {
  return sharp(join(generatedRoot, relative))
    .extract({ left: 48, top: 0, width: 48, height: 72 })
    .png()
    .toBuffer();
}

async function idleFrame(relative) {
  return sharp(join(generatedRoot, relative))
    .extract({ left: 0, top: 0, width: 48, height: 72 })
    .png()
    .toBuffer();
}

async function composeLayers(layers) {
  const buffers = await Promise.all(layers.map((layer) => walkFrame(layer)));
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

const samples = [];

for (const hair of catalog.hairStyles) {
  const defaults = catalog.defaults[hair.family];
  for (const color of catalog.hairColors) {
    samples.push({
      label: `${hair.id} / ${color.id}`,
      image: await composeLayers(defaultLayers(
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
      image: await composeLayers(defaultLayers(
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
    label: skin.id,
    image: await composeLayers(defaultLayers(
      "feminine",
      skin.id,
      defaults.hairStyle,
      defaults.hairColor,
      defaults.outfit,
      defaults.outfitPalette
    ))
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
  samples.push({ label: accessory.id, image: await composeLayers(layers) });
}

for (const npc of catalog.npcs) {
  samples.push({
    label: npc.id,
    image: await idleFrame(`npc/${npc.id}__idle.png`)
  });
}

const rows = Math.ceil(samples.length / columns);
const contactSheet = sharp({
  create: {
    width: columns * tileWidth,
    height: rows * tileHeight,
    channels: 4,
    background: "#f4efe7ff"
  }
});

const composites = [];
for (let index = 0; index < samples.length; index += 1) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const scaled = await sharp(samples[index].image)
    .resize(96, 144, { kernel: "nearest" })
    .png()
    .toBuffer();
  composites.push({
    input: scaled,
    left: column * tileWidth + 4,
    top: row * tileHeight + 4
  });
}

await mkdir(dirname(output), { recursive: true });
await contactSheet.composite(composites).png({ compressionLevel: 9 }).toFile(output);
console.log(`Rendered ${samples.length} samples to ${output}`);
