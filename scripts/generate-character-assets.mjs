import { access, copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateVariant, validateDimensions } from "./lib/characterAssetGenerator.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "shared/character-catalog.json"), "utf8"));
const skinPalettes = JSON.parse(await readFile(join(root, "character-assets/palettes/skin.json"), "utf8"));
const hairPalettes = JSON.parse(await readFile(join(root, "character-assets/palettes/hair.json"), "utf8"));
const outfitConfig = JSON.parse(await readFile(join(root, "character-assets/palettes/outfits.json"), "utf8"));
const sourceRoot = join(root, "character-assets/source");
const outputRoot = join(root, "client/public/characters/generated");
const outputs = new Set();
const fixedPixelColors = ["#251812", "#fff4dc", "#b75d65", "#d47777"];

function outputPath(relative) {
  const target = join(outputRoot, relative);
  if (outputs.has(target)) throw new Error(`Duplicate character output: ${relative}`);
  outputs.add(target);
  return target;
}

function paletteFromArray(values) {
  return Object.fromEntries(outfitConfig.markers.map((marker, index) => [marker, values[index]]));
}

async function requireFile(file, dimensions) {
  await access(file);
  await validateDimensions(file, dimensions);
}

async function copyFixed(source, relative, dimensions) {
  await requireFile(source, dimensions);
  const target = outputPath(relative);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

await rm(outputRoot, { recursive: true, force: true });

for (const family of ["masculine", "feminine"]) {
  const walkSource = join(sourceRoot, "base", `${family}-walk.png`);
  const idleSource = join(sourceRoot, "base", `${family}-idle.png`);
  await requireFile(walkSource, { width: 144, height: 288 });
  await requireFile(idleSource, { width: 96, height: 72 });

  for (const skin of catalog.skinTones) {
    const palette = skinPalettes[skin.id];
    if (!palette) throw new Error(`Missing skin palette: ${skin.id}`);
    await generateVariant(walkSource, outputPath(`base/${family}__${skin.id}__walk.png`), palette, {
      allowedFixedColors: fixedPixelColors
    });
    await generateVariant(idleSource, outputPath(`base/${family}__${skin.id}__idle.png`), palette, {
      allowedFixedColors: fixedPixelColors
    });
  }
}

for (const hair of catalog.hairStyles) {
  const backSource = join(sourceRoot, "hair", `${hair.id}__back-walk.png`);
  const frontSource = join(sourceRoot, "hair", `${hair.id}__front-walk.png`);
  await requireFile(backSource, { width: 144, height: 288 });
  await requireFile(frontSource, { width: 144, height: 288 });

  for (const color of catalog.hairColors) {
    const palette = hairPalettes[color.id];
    if (!palette) throw new Error(`Missing hair palette: ${color.id}`);
    await generateVariant(
      backSource,
      outputPath(`hair/${hair.id}__${color.id}__back-walk.png`),
      palette,
      { allowedFixedColors: ["#251812"] }
    );
    await generateVariant(
      frontSource,
      outputPath(`hair/${hair.id}__${color.id}__front-walk.png`),
      palette,
      { allowedFixedColors: ["#251812"] }
    );
  }
}

const referencedOutfitPalettes = new Set(catalog.outfits.flatMap((outfit) => outfit.palettes));
const declaredOutfitPalettes = new Set(Object.keys(outfitConfig.palettes));
if (
  referencedOutfitPalettes.size !== declaredOutfitPalettes.size ||
  [...referencedOutfitPalettes].some((id) => !declaredOutfitPalettes.has(id))
) {
  throw new Error("Outfit palette IDs do not match the catalog");
}

for (const outfit of catalog.outfits) {
  const source = join(sourceRoot, "outfits", `${outfit.id}__walk.png`);
  await requireFile(source, { width: 144, height: 288 });
  for (const paletteId of outfit.palettes) {
    await generateVariant(
      source,
      outputPath(`outfits/${outfit.id}__${paletteId}__walk.png`),
      paletteFromArray(outfitConfig.palettes[paletteId]),
      { allowedFixedColors: ["#251812"] }
    );
  }
}

for (const accessory of catalog.accessories) {
  await copyFixed(
    join(sourceRoot, "accessories", `${accessory.id}__walk.png`),
    `accessories/${accessory.id}__walk.png`,
    { width: 144, height: 288 }
  );
}

for (const npc of catalog.npcs) {
  await copyFixed(
    join(sourceRoot, "npc", `${npc.id}-idle.png`),
    `npc/${npc.id}__idle.png`,
    { width: 96, height: 72 }
  );
}

console.log(`Generated ${outputs.size} character assets`);
