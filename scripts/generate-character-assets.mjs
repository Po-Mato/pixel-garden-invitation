import { access, copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateVariant, validateDimensions } from "./lib/characterAssetGenerator.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "shared/character-catalog.json"), "utf8"));
const guestPartManifest = JSON.parse(await readFile(join(root, "character-assets/guest-part-manifest.json"), "utf8"));
const skinPalettes = JSON.parse(await readFile(join(root, "character-assets/palettes/skin.json"), "utf8"));
const hairPalettes = JSON.parse(await readFile(join(root, "character-assets/palettes/hair.json"), "utf8"));
const outfitConfig = JSON.parse(await readFile(join(root, "character-assets/palettes/outfits.json"), "utf8"));
const defaultSourceRoot = join(root, "character-assets/source");
const defaultOutputRoot = join(root, "client/public/characters/generated");
const fixedPixelColors = ["#251812", "#fff4dc", "#b75d65", "#d47777"];
const guestIdleDimensions = guestPartManifest.frame.idle.sheet;
const guestWalkDimensions = guestPartManifest.frame.walk.sheet;
const npcIdleDimensions = { width: 192, height: 144 };
const npcWalkDimensions = { width: 288, height: 576 };

function paletteFromArray(values) {
  return Object.fromEntries(outfitConfig.markers.map((marker, index) => [marker, values[index]]));
}

async function requireFile(file, dimensions) {
  await access(file);
  await validateDimensions(file, dimensions);
}

function sourcePath(sourceRoot, manifestPath) {
  return join(sourceRoot, manifestPath.replace(/^character-assets\/source\//, ""));
}

function resolveTemplate(template, values) {
  return template.replaceAll(/\{([^}]+)\}/g, (_match, key) => {
    const value = values[key];
    if (!value) throw new Error(`Missing guest part template value: ${key}`);
    return value;
  });
}

async function prevalidateSources(sourceRoot) {
  for (const part of guestPartManifest.parts.base) {
    await requireFile(
      sourcePath(sourceRoot, part.source.walk),
      guestWalkDimensions
    );
    await requireFile(
      sourcePath(sourceRoot, part.source.idle),
      guestIdleDimensions
    );
  }

  for (const hair of guestPartManifest.parts.hair) {
    await requireFile(
      sourcePath(sourceRoot, hair.source.backWalk),
      guestWalkDimensions
    );
    await requireFile(
      sourcePath(sourceRoot, hair.source.frontWalk),
      guestWalkDimensions
    );
  }

  for (const outfit of guestPartManifest.parts.outfits) {
    await requireFile(
      sourcePath(sourceRoot, outfit.source.walk),
      guestWalkDimensions
    );
  }

  for (const accessory of guestPartManifest.parts.accessories) {
    await requireFile(
      sourcePath(sourceRoot, accessory.source.walk),
      guestWalkDimensions
    );
  }

  for (const npc of catalog.npcs) {
    await requireFile(
      join(sourceRoot, "npc", `${npc.id}-idle.png`),
      npcIdleDimensions
    );
    await requireFile(
      join(sourceRoot, "npc", `${npc.id}-walk.png`),
      npcWalkDimensions
    );
  }
}

function validatePalettes() {
  for (const skin of catalog.skinTones) {
    if (!skinPalettes[skin.id]) throw new Error(`Missing skin palette: ${skin.id}`);
  }

  for (const color of catalog.hairColors) {
    if (!hairPalettes[color.id]) throw new Error(`Missing hair palette: ${color.id}`);
  }

  const referencedOutfitPalettes = new Set(catalog.outfits.flatMap((outfit) => outfit.palettes));
  const declaredOutfitPalettes = new Set(Object.keys(outfitConfig.palettes));
  if (
    referencedOutfitPalettes.size !== declaredOutfitPalettes.size ||
    [...referencedOutfitPalettes].some((id) => !declaredOutfitPalettes.has(id))
  ) {
    throw new Error("Outfit palette IDs do not match the catalog");
  }
}

export async function generateCharacterAssets({
  sourceRoot = defaultSourceRoot,
  outputRoot = defaultOutputRoot
} = {}) {
  validatePalettes();
  await prevalidateSources(sourceRoot);

  const outputs = new Set();
  const outputPath = (relative) => {
    const target = join(outputRoot, relative);
    if (outputs.has(target)) throw new Error(`Duplicate character output: ${relative}`);
    outputs.add(target);
    return target;
  };
  const copyFixed = async (source, relative) => {
    const target = outputPath(relative);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  };

  await rm(outputRoot, { recursive: true, force: true });

  for (const part of guestPartManifest.parts.base) {
    const walkSource = sourcePath(sourceRoot, part.source.walk);
    const idleSource = sourcePath(sourceRoot, part.source.idle);

    for (const skin of catalog.skinTones) {
      const palette = skinPalettes[skin.id];
      await generateVariant(
        walkSource,
        outputPath(resolveTemplate(part.generated.walk, { skinTone: skin.id })),
        palette,
        { allowedFixedColors: fixedPixelColors }
      );
      await generateVariant(
        idleSource,
        outputPath(resolveTemplate(part.generated.idle, { skinTone: skin.id })),
        palette,
        { allowedFixedColors: fixedPixelColors }
      );
    }
  }

  for (const hair of guestPartManifest.parts.hair) {
    const backSource = sourcePath(sourceRoot, hair.source.backWalk);
    const frontSource = sourcePath(sourceRoot, hair.source.frontWalk);

    for (const color of catalog.hairColors) {
      const palette = hairPalettes[color.id];
      await generateVariant(
        backSource,
        outputPath(resolveTemplate(hair.generated.backWalk, { hairColor: color.id })),
        palette,
        { allowedFixedColors: ["#251812"] }
      );
      await generateVariant(
        frontSource,
        outputPath(resolveTemplate(hair.generated.frontWalk, { hairColor: color.id })),
        palette,
        { allowedFixedColors: ["#251812"] }
      );
    }
  }

  for (const outfit of guestPartManifest.parts.outfits) {
    const source = sourcePath(sourceRoot, outfit.source.walk);
    const catalogOutfit = catalog.outfits.find((item) => item.id === outfit.id);
    if (!catalogOutfit) throw new Error(`Missing catalog outfit for guest manifest part: ${outfit.id}`);

    for (const paletteId of catalogOutfit.palettes) {
      await generateVariant(
        source,
        outputPath(resolveTemplate(outfit.generated.walk, { outfitPalette: paletteId })),
        paletteFromArray(outfitConfig.palettes[paletteId]),
        { allowedFixedColors: ["#251812"] }
      );
    }
  }

  for (const accessory of guestPartManifest.parts.accessories) {
    await copyFixed(
      sourcePath(sourceRoot, accessory.source.walk),
      accessory.generated.walk
    );
  }

  for (const npc of catalog.npcs) {
    await copyFixed(
      join(sourceRoot, "npc", `${npc.id}-idle.png`),
      `npc/${npc.id}__idle.png`
    );
    await copyFixed(
      join(sourceRoot, "npc", `${npc.id}-walk.png`),
      `npc/${npc.id}__walk.png`
    );
  }

  return outputs.size;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputCount = await generateCharacterAssets();
  console.log(`Generated ${outputCount} character assets`);
}
