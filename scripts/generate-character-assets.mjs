import { access, copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { validateDimensions } from "./lib/characterAssetGenerator.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "shared/character-catalog.json"), "utf8"));
const guestPresetCatalog = JSON.parse(await readFile(join(root, "character-assets/guest-character-presets.json"), "utf8"));
const defaultSourceRoot = join(root, "character-assets/source");
const defaultOutputRoot = join(root, "client/public/characters/generated");
const guestIdleDimensions = guestPresetCatalog.frame.idle.sheet;
const guestWalkDimensions = guestPresetCatalog.frame.walk.sheet;
const guestWorldIdleDimensions = {
  width: guestPresetCatalog.frame.worldSource.width * guestPresetCatalog.frame.idle.columns,
  height: guestPresetCatalog.frame.worldSource.height
};
const guestWorldWalkDimensions = {
  width: guestPresetCatalog.frame.worldSource.width * guestPresetCatalog.frame.walk.columns,
  height: guestPresetCatalog.frame.worldSource.height * guestPresetCatalog.frame.walk.rows.length
};
const npcIdleDimensions = { width: 192, height: 144 };
const npcWalkDimensions = { width: 288, height: 576 };

async function requireFile(file, dimensions) {
  await access(file);
  await validateDimensions(file, dimensions);
}

function sourcePath(sourceRoot, manifestPath) {
  return join(sourceRoot, manifestPath.replace(/^character-assets\/source\//, ""));
}

async function prevalidateSources(sourceRoot) {
  for (const preset of guestPresetCatalog.presets) {
    await requireFile(sourcePath(sourceRoot, preset.source.walk), guestWalkDimensions);
    await requireFile(sourcePath(sourceRoot, preset.source.idle), guestIdleDimensions);
  }

  for (const npc of catalog.npcs) {
    await requireFile(join(sourceRoot, "npc", `${npc.id}-idle.png`), npcIdleDimensions);
    await requireFile(join(sourceRoot, "npc", `${npc.id}-walk.png`), npcWalkDimensions);
  }
}

export async function generateCharacterAssets({
  sourceRoot = defaultSourceRoot,
  outputRoot = defaultOutputRoot
} = {}) {
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
  const writeCoarse = async (source, relative, dimensions) => {
    const target = outputPath(relative);
    await mkdir(dirname(target), { recursive: true });
    await sharp(source)
      .resize(dimensions.width, dimensions.height, {
        fit: "fill",
        kernel: sharp.kernel.nearest
      })
      .png()
      .toFile(target);
  };

  await rm(outputRoot, { recursive: true, force: true });

  for (const preset of guestPresetCatalog.presets) {
    const walkSource = sourcePath(sourceRoot, preset.source.walk);
    const idleSource = sourcePath(sourceRoot, preset.source.idle);
    await copyFixed(walkSource, preset.generated.walk);
    await copyFixed(idleSource, preset.generated.idle);
    await writeCoarse(
      walkSource,
      `guests/world/${preset.id}__walk.png`,
      guestWorldWalkDimensions
    );
    await writeCoarse(
      idleSource,
      `guests/world/${preset.id}__idle.png`,
      guestWorldIdleDimensions
    );
  }

  for (const npc of catalog.npcs) {
    await copyFixed(join(sourceRoot, "npc", `${npc.id}-idle.png`), `npc/${npc.id}__idle.png`);
    await copyFixed(join(sourceRoot, "npc", `${npc.id}-walk.png`), `npc/${npc.id}__walk.png`);
  }

  return outputs.size;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputCount = await generateCharacterAssets();
  console.log(`Generated ${outputCount} character assets`);
}
