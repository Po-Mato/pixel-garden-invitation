import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path, { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { cleanGuestHairSheet, waveHairPresetIds } from "./lib/guestHairBackground.mjs";
import {
  characterVisualAnchorAlphaThreshold,
  measureAlphaVisualAnchor
} from "./lib/characterVisualAnchor.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(rootDir, "character-assets/guest-character-presets.json");
const outputPath = path.join(rootDir, "client/src/character/worldAnchors.generated.json");
const sourceRoot = path.join(rootDir, "character-assets/source");
const checkOnly = process.argv.includes("--check");

function stableManifest(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function derivePresetAnchor(preset, frame) {
  const idlePath = path.join(sourceRoot, preset.source.idle.replace(/^character-assets\/source\//, ""));
  const source = waveHairPresetIds.has(preset.id)
    ? await cleanGuestHairSheet(idlePath, frame.source)
    : await readFile(idlePath);
  const extracted = await sharp(source)
    .extract({ left: 0, top: 0, width: frame.source.width, height: frame.source.height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const measured = measureAlphaVisualAnchor(extracted.data, {
    width: extracted.info.width,
    height: extracted.info.height,
    channels: extracted.info.channels
  });
  return {
    centerX: measured.centerX,
    centerY: measured.centerY,
    feetY: measured.feetY,
    bounds: measured.bounds,
    sourceSha256: createHash("sha256").update(source).digest("hex")
  };
}

export async function buildCharacterWorldAnchorManifest() {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const entries = await Promise.all(catalog.presets.map(async (preset) => [
    preset.id,
    await derivePresetAnchor(preset, catalog.frame)
  ]));
  return {
    version: 1,
    source: "generated idle open-frame alpha bounds",
    alphaThreshold: characterVisualAnchorAlphaThreshold,
    sourceSize: catalog.frame.source,
    presets: Object.fromEntries(entries)
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const next = stableManifest(await buildCharacterWorldAnchorManifest());
  if (checkOnly) {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current !== next) {
      throw new Error("Character world anchors drifted. Run pnpm characters:generate and commit the generated manifest.");
    }
    console.log("Character world anchor manifest is current");
  } else {
    await writeFile(outputPath, next);
    console.log("Generated character world anchors for 12 guest presets");
  }
}
