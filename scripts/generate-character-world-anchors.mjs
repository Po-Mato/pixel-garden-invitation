import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path, { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import assert from "node:assert/strict";
import {
  characterVisualAnchorAlphaThreshold,
  measureAlphaVisualAnchor
} from "./lib/characterVisualAnchor.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(rootDir, "character-assets/guest-character-presets.json");
const outputPath = path.join(rootDir, "client/src/character/worldAnchors.generated.json");
const generatedRoot = path.join(rootDir, "client/public/characters/generated");
const checkOnly = process.argv.includes("--check");

function stableManifest(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function derivePresetAnchor(preset, frame, skeleton) {
  const idlePath = path.join(generatedRoot, preset.generated.idle);
  const source = await readFile(idlePath);
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
    // Clothing, hair, bags and resampling fringes must not re-center the rig.
    // Alpha bounds are useful diagnostics, never the source of body geometry.
    centerX: skeleton.geometry.centerX * frame.source.width / skeleton.canvas[0],
    centerY: (skeleton.geometry.headTop + skeleton.geometry.baselineY) / 2 * frame.source.height / skeleton.canvas[1],
    feetY: skeleton.geometry.baselineY * frame.source.height / skeleton.canvas[1],
    bounds: measured.bounds,
    sourceSha256: createHash("sha256").update(source).digest("hex")
  };
}

export async function buildCharacterWorldAnchorManifest() {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const skeleton = JSON.parse(await readFile(path.join(rootDir, "character-assets/rigs/common-three-head-216-v1/skeleton.json"), "utf8"));
  assert.deepEqual(skeleton.canvas, [192, 288]);
  assert.deepEqual([skeleton.geometry.headHeight, skeleton.geometry.bodyHeight, skeleton.geometry.characterHeight], [72, 144, 216]);
  const entries = await Promise.all(catalog.presets.map(async (preset) => [
    preset.id,
    await derivePresetAnchor(preset, catalog.frame, skeleton)
  ]));
  return {
    version: 2,
    source: "common-three-head-216-v1 authored skeleton; alpha bounds are diagnostic only",
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
